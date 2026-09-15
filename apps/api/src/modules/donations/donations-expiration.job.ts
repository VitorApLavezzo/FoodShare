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

  private async run() {
    const overdue = await this.prisma.donationList.findMany({
      where: {
        status: { in: [DonationListStatus.OPEN, DonationListStatus.FULLY_RESERVED] },
        expiresAt: { lt: new Date() },
        deletedAt: null,
      },
      select: { id: true, nodeId: true },
    });

    if (overdue.length === 0) return;

    for (const list of overdue) {
      await this.prisma.$transaction(async (tx) => {
        // Item não retirado vira EXPIRED (não CANCELLED): preserva a diferença
        // entre "o doador desistiu" e "venceu sem ninguém buscar" nos relatórios.
        await tx.donationItem.updateMany({
          where: { donationListId: list.id, status: DonationItemStatus.AVAILABLE },
          data: { status: DonationItemStatus.EXPIRED },
        });
        await recomputeDonationListStatus(tx, list.id);
      });

      await this.auditLogService.record({
        entity: 'DonationList',
        entityId: list.id,
        donationListId: list.id,
        eventType: 'DONATION_LIST_EXPIRED',
        nodeId: list.nodeId,
        newData: { status: DonationListStatus.EXPIRED },
      });
      await this.notificationsService.removeForDonationList(list.id);
    }

    this.logger.log(`${overdue.length} lista(s) de doação encerrada(s) por expiração.`);
  }
}
