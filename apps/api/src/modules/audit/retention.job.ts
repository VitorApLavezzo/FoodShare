import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SyncEventStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaderLockService } from '../../common/leader-lock.service';

/**
 * audit_logs e sync_events crescem uma linha por evento de negócio, para
 * sempre, e cada registro de auditoria guarda um retrato completo da entidade
 * em JSON. Sem expurgo, as duas tabelas só crescem — e as contagens do painel
 * de sincronização varrem elas inteiras.
 *
 * Eventos de sincronização já entregues são descartáveis (o dado real está nas
 * tabelas de negócio); os que falharam são preservados, porque são justamente
 * os que alguém precisa investigar.
 */
@Injectable()
export class RetentionJob {
  private readonly logger = new Logger(RetentionJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeOldRecords() {
    await this.leaderLock.runExclusively('retention', () => this.run(), 300);
  }

  private async run() {
    const auditDays = this.config.get<number>('retention.auditLogDays') ?? 180;
    const syncDays = this.config.get<number>('retention.syncEventDays') ?? 30;

    const [audit, sync] = await Promise.all([
      this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - auditDays * 86_400_000) } },
      }),
      this.prisma.syncEvent.deleteMany({
        where: {
          status: SyncEventStatus.SYNCED,
          createdAt: { lt: new Date(Date.now() - syncDays * 86_400_000) },
        },
      }),
    ]);

    if (audit.count || sync.count) {
      this.logger.log(
        `Expurgo: ${audit.count} registro(s) de auditoria (>${auditDays}d) e ${sync.count} evento(s) sincronizado(s) (>${syncDays}d).`,
      );
    }
  }
}
