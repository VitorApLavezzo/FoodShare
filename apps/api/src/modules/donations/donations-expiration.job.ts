import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DonationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

@Injectable()
export class DonationsExpirationJob {
  private readonly logger = new Logger(DonationsExpirationJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireOverdueDonations() {
    const overdue = await this.prisma.donation.findMany({
      where: { status: DonationStatus.AVAILABLE, expiresAt: { lt: new Date() }, deletedAt: null },
      select: { id: true, nodeId: true },
    });

    if (overdue.length === 0) return;

    await this.prisma.donation.updateMany({
      where: { id: { in: overdue.map((d) => d.id) } },
      data: { status: DonationStatus.EXPIRED },
    });

    await Promise.all(
      overdue.map((d) =>
        this.auditLogService.record({
          entity: 'Donation',
          entityId: d.id,
          donationId: d.id,
          eventType: 'DONATION_EXPIRED',
          nodeId: d.nodeId,
          newData: { status: DonationStatus.EXPIRED },
        }),
      ),
    );

    this.logger.log(`${overdue.length} doação(ões) marcada(s) como EXPIRED.`);
  }
}
