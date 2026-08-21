import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DonationItemStatus, DonationListStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DonationsExpirationJob {
  private readonly logger = new Logger(DonationsExpirationJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverdueDonations() {
    const overdue = await this.prisma.donationList.findMany({
      where: {
        status: DonationListStatus.OPEN,
        expiresAt: { lt: new Date() },
        deletedAt: null,
      },
      select: { id: true, nodeId: true },
    });

    if (overdue.length === 0) return;

    const overdueIds = overdue.map((d) => d.id);

    await this.prisma.$transaction([
      this.prisma.donationItem.updateMany({
        where: { donationListId: { in: overdueIds }, status: DonationItemStatus.AVAILABLE },
        data: { status: DonationItemStatus.CANCELLED },
      }),
      this.prisma.donationList.updateMany({
        where: { id: { in: overdueIds } },
        data: { status: DonationListStatus.CLOSED },
      }),
    ]);

    await Promise.all(
      overdue.map((d) =>
        this.auditLogService.record({
          entity: 'DonationList',
          entityId: d.id,
          donationListId: d.id,
          eventType: 'DONATION_LIST_EXPIRED',
          nodeId: d.nodeId,
          newData: { status: DonationListStatus.CLOSED },
        }),
      ),
    );

    await Promise.all(overdueIds.map((id) => this.notificationsService.removeForDonationList(id)));

    this.logger.log(`${overdue.length} lista(s) de doação marcada(s) como CLOSED por expiração.`);
  }
}
