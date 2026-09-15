import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requestContext } from '../../common/request-context';

export interface RecordAuditLogInput {
  entity: string;
  entityId: string;
  eventType: string;
  userId?: string;
  nodeId: string;
  donationListId?: string;
  previousData?: unknown;
  newData?: unknown;
  correlationId?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Best-effort: uma falha ao gravar auditoria nunca deve derrubar a operação de
   * negócio que a originou. Loga o erro e segue.
   */
  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entity: input.entity,
          entityId: input.entityId,
          eventType: input.eventType,
          userId: input.userId,
          nodeId: input.nodeId,
          donationListId: input.donationListId,
          previousData: (input.previousData ?? undefined) as Prisma.InputJsonValue,
          newData: (input.newData ?? undefined) as Prisma.InputJsonValue,
          // Cai para o ID da requisição em curso quando o chamador não informa —
          // na prática nenhum informava, e a coluna vivia nula.
          correlationId: input.correlationId ?? requestContext.getCorrelationId(),
        },
      });
    } catch (err) {
      this.logger.error(`Falha ao gravar audit log (${input.entity}/${input.eventType})`, err as Error);
    }
  }

  async findMany(params: { entity?: string; entityId?: string; page?: number; limit?: number }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;

    const where = {
      ...(params.entity ? { entity: params.entity } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
