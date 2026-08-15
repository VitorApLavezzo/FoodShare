import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { SyncEventStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const STREAM_KEY = 'foodshare:sync-stream';
const CURSOR_KEY_PREFIX = 'foodshare:sync-cursor:';
const MAX_RETRIES = 10;
const BLOCK_MS = 5000;

export interface SyncEventPayload {
  eventId: string;
  originNode: string;
  sequence: string;
  eventType: string;
  entityId: string;
  payload: unknown;
  timestamp: string;
}

/**
 * Publica e recebe eventos de domínio entre instâncias (nós) via Redis Streams
 * (XADD/XREAD), não Pub/Sub simples.
 *
 * Por quê Streams e não Pub/Sub: Pub/Sub é fire-and-forget — uma mensagem
 * publicada enquanto um nó está desligado é perdida para sempre, o que viola
 * diretamente o requisito da seção 47 ("eventos não devem ser simplesmente
 * perdidos; devem permanecer pendentes; quando o nó voltar, deve ocorrer
 * sincronização"). Um Stream persiste as entradas no Redis; cada nó guarda seu
 * próprio cursor (`foodshare:sync-cursor:<NODE_ID>`) e retoma a leitura de onde
 * parou ao reconectar — inclusive depois de o container do nó ser reiniciado —
 * então nenhum evento publicado durante a queda é perdido.
 *
 * Decisão de arquitetura (mantida da Fase 10): os nós ainda compartilham o
 * mesmo Postgres, então "receber" um evento não precisa reescrever dados — já
 * estão visíveis via o banco compartilhado. Esta camada demonstra e garante os
 * mecanismos pedidos na especificação (publicação assíncrona, idempotência via
 * eventId, retry, rastreamento de falhas, catch-up após reconexão) —
 * pré-requisitos para migrar para bancos por nó no futuro sem reescrever a
 * camada de sincronização.
 */
@Injectable()
export class SyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncService.name);
  private readonly publisher: Redis;
  private readonly reader: Redis;
  private readonly nodeId: string;
  private readonly cursorKey: string;
  private running = true;
  private readLoopPromise: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const redisUrl = this.config.get<string>('redisUrl')!;
    this.publisher = new Redis(redisUrl);
    this.reader = new Redis(redisUrl);
    this.nodeId = this.config.get<string>('node.id')!;
    this.cursorKey = `${CURSOR_KEY_PREFIX}${this.nodeId}`;
  }

  async onModuleInit() {
    this.running = true;
    this.readLoopPromise = this.readLoop();
    this.logger.log(`Consumidor de sincronização iniciado (stream "${STREAM_KEY}")`);
  }

  async onModuleDestroy() {
    this.running = false;
    await this.readLoopPromise?.catch(() => undefined);
    await this.publisher.quit().catch(() => undefined);
    await this.reader.quit().catch(() => undefined);
  }

  async publishEvent(eventType: string, entityId: string, payload: unknown) {
    const sequence = await this.prisma.syncEvent.count({ where: { originNode: this.nodeId } });

    const event = await this.prisma.syncEvent.create({
      data: {
        eventId: randomUUID(),
        originNode: this.nodeId,
        sequence: BigInt(sequence + 1),
        eventType,
        entityId,
        payload: payload as object,
        status: SyncEventStatus.PENDING,
      },
    });

    await this.attemptDelivery(event.id, event.eventId, {
      eventId: event.eventId,
      originNode: event.originNode,
      sequence: event.sequence.toString(),
      eventType: event.eventType,
      entityId: event.entityId,
      payload: event.payload,
      timestamp: event.createdAt.toISOString(),
    });
  }

  private async attemptDelivery(rowId: string, eventId: string, message: SyncEventPayload) {
    try {
      await this.publisher.xadd(STREAM_KEY, '*', 'data', JSON.stringify(message));
      await this.prisma.syncEvent.update({
        where: { id: rowId },
        data: { status: SyncEventStatus.SYNCED, syncedAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`Falha ao publicar evento ${eventId}: ${(err as Error).message}`);
      await this.prisma.syncEvent.update({
        where: { id: rowId },
        data: {
          status: SyncEventStatus.FAILED,
          retryCount: { increment: 1 },
          errorMessage: (err as Error).message,
        },
      });
    }
  }

  /**
   * Lê continuamente o stream a partir do cursor persistido deste nó. Ao
   * reiniciar (ex.: depois de uma queda simulada), retoma exatamente de onde
   * parou — nenhuma entrada publicada durante a ausência é pulada.
   */
  private async readLoop() {
    let cursor = (await this.reader.get(this.cursorKey)) ?? '$';

    while (this.running) {
      try {
        const result = await this.reader.xread('BLOCK', BLOCK_MS, 'STREAMS', STREAM_KEY, cursor);
        if (!result) continue;

        const [, entries] = result[0];
        for (const [entryId, fields] of entries) {
          cursor = entryId;
          const dataIndex = fields.indexOf('data');
          if (dataIndex !== -1 && fields[dataIndex + 1]) {
            await this.handleIncoming(fields[dataIndex + 1]);
          }
        }
        await this.reader.set(this.cursorKey, cursor);
      } catch (err) {
        if (!this.running) return;
        this.logger.error('Erro no loop de leitura do stream de sincronização', err as Error);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  private async handleIncoming(raw: string) {
    let message: SyncEventPayload;
    try {
      message = JSON.parse(raw);
    } catch {
      this.logger.warn('Mensagem de sincronização inválida (JSON malformado), descartada.');
      return;
    }

    if (message.originNode === this.nodeId) {
      // Eco da própria publicação: já processado localmente, ignorar.
      return;
    }

    // Idempotência: o evento já existe no banco compartilhado (criado pelo nó de
    // origem, identificado por eventId). Não recriamos a entidade — apenas
    // confirmamos o recebimento. Se este nó tivesse banco próprio, aqui seria o
    // ponto de aplicar o payload.
    this.logger.log(
      `[sync] Nó ${this.nodeId} recebeu ${message.eventType} (entidade ${message.entityId}) do nó ${message.originNode}, sequência ${message.sequence}`,
    );
  }

  /**
   * Reenvia eventos que falharam ao publicar (ex.: Redis momentaneamente
   * indisponível). Eventos com muitas tentativas ficam marcados como FAILED
   * permanentemente e aparecem no painel administrativo.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async retryFailedEvents() {
    const pending = await this.prisma.syncEvent.findMany({
      where: {
        originNode: this.nodeId,
        status: { in: [SyncEventStatus.PENDING, SyncEventStatus.FAILED] },
        retryCount: { lt: MAX_RETRIES },
      },
      take: 50,
    });

    for (const event of pending) {
      await this.attemptDelivery(event.id, event.eventId, {
        eventId: event.eventId,
        originNode: event.originNode,
        sequence: event.sequence.toString(),
        eventType: event.eventType,
        entityId: event.entityId,
        payload: event.payload,
        timestamp: event.createdAt.toISOString(),
      });
    }

    if (pending.length > 0) {
      this.logger.log(`Retentativa de sincronização: ${pending.length} evento(s) reprocessado(s).`);
    }
  }

  async getStatus() {
    const [pending, synced, failed, lastSynced] = await Promise.all([
      this.prisma.syncEvent.count({ where: { status: SyncEventStatus.PENDING } }),
      this.prisma.syncEvent.count({ where: { status: SyncEventStatus.SYNCED } }),
      this.prisma.syncEvent.count({ where: { status: SyncEventStatus.FAILED } }),
      this.prisma.syncEvent.findFirst({
        where: { status: SyncEventStatus.SYNCED },
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true, originNode: true, eventType: true },
      }),
    ]);

    return { pending, synced, failed, lastSynced };
  }

  async findRecentEvents(limit = 50) {
    const events = await this.prisma.syncEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return events.map((e) => ({ ...e, sequence: e.sequence.toString() }));
  }
}
