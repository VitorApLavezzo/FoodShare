import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DonationItemStatus, DonationListStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LeaderLockService } from '../../common/leader-lock.service';
import { recomputeDonationListStatus } from './donation-list-status';

@Injectable()
export class DonationsExpirationJob {
  private readonly logger = new Logger(DonationsExpirationJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
    private readonly leaderLock: LeaderLockService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverdueDonations() {
    // Os 3 nós rodam o mesmo cron sobre o mesmo banco: sem o lock, cada expiração
    // gerava auditoria e notificação em triplicata.
    await this.leaderLock.runExclusively('donations-expiration', () => this.run());
  }

  /**
   * O prazo de retirada é de cada item: passado o dele, o item sai da oferta
   * mesmo que os outros da lista continuem disponíveis. A lista só encerra
   * quando não sobra nada reservável nela.
   */
  private async run() {
    const now = new Date();
    const overdue = await this.prisma.donationItem.findMany({
      where: {
        status: DonationItemStatus.AVAILABLE,
        pickupDeadline: { lt: now },
        donationList: { deletedAt: null },
      },
      select: { id: true, donationListId: true, donationList: { select: { nodeId: true } } },
    });

    if (overdue.length === 0) return;

    const byList = new Map<string, { nodeId: string; itemIds: string[] }>();
    for (const item of overdue) {
      const entry = byList.get(item.donationListId) ?? { nodeId: item.donationList.nodeId, itemIds: [] };
      entry.itemIds.push(item.id);
      byList.set(item.donationListId, entry);
    }

    for (const [donationListId, { nodeId, itemIds }] of byList) {
      const status = await this.prisma.$transaction(async (tx) => {
        // Item não retirado vira EXPIRED (não CANCELLED): preserva a diferença
        // entre "o doador desistiu" e "venceu sem ninguém buscar" nos relatórios.
        await tx.donationItem.updateMany({
          where: { id: { in: itemIds }, status: DonationItemStatus.AVAILABLE },
          data: { status: DonationItemStatus.EXPIRED },
        });
        return recomputeDonationListStatus(tx, donationListId);
      });

      await this.auditLogService.record({
        entity: 'DonationList',
        entityId: donationListId,
        donationListId,
        eventType: status === DonationListStatus.EXPIRED ? 'DONATION_LIST_EXPIRED' : 'DONATION_ITEMS_EXPIRED',
        nodeId,
        newData: { status, expiredItemIds: itemIds },
      });
      // Sem nada reservável, o alerta de "doação disponível" perdeu o sentido.
      if (status !== DonationListStatus.OPEN) {
        await this.notificationsService.removeForDonationList(donationListId);
      }
    }

    this.logger.log(`${overdue.length} item(ns) de doação encerrado(s) por fim do prazo de retirada.`);
  }
}
