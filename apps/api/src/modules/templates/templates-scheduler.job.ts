import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DonationRecurrence, DonationTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaderLockService } from '../../common/leader-lock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateDonationItemDto } from '../donations/dto/create-donation-item.dto';

@Injectable()
export class TemplatesSchedulerJob {
  private readonly logger = new Logger(TemplatesSchedulerJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly leaderLock: LeaderLockService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Publica as doações recorrentes cuja hora chegou. Roda a cada 15 minutos e
   * usa `lastGeneratedAt` para não publicar duas vezes no mesmo dia, mesmo que
   * o job execute várias vezes dentro da janela.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async generateScheduledDonations() {
    await this.leaderLock.runExclusively('templates-scheduler', () => this.run());
  }

  private async run() {
    const templates = await this.prisma.donationTemplate.findMany({
      where: { isActive: true, donorOrganization: { deletedAt: null } },
      include: { donorOrganization: true },
    });

    const now = new Date();
    let generated = 0;

    for (const template of templates) {
      if (!this.isDue(template, now)) continue;

      const items = template.items as unknown as CreateDonationItemDto[];
      const list = await this.prisma.donationList.create({
        data: {
          donorOrganizationId: template.donorOrganizationId,
          nodeId: this.config.get<string>('node.id')!,
          allowPartial: template.allowPartial,
          notes: template.notes,
          availableAt: now,
          pickupDeadline: new Date(now.getTime() + template.pickupWindowHours * 3_600_000),
          expiresAt: new Date(now.getTime() + template.expiresInHours * 3_600_000),
          items: {
            create: items.map((item) => ({
              foodName: item.foodName,
              category: item.category,
              description: item.description,
              quantity: item.quantity,
              remainingQuantity: item.quantity,
              unit: item.unit,
              storageCondition: item.storageCondition,
              allergens: item.allergens,
              imageUrl: item.imageUrl,
            })),
          },
        },
        include: { items: true },
      });

      await this.prisma.donationTemplate.update({
        where: { id: template.id },
        data: { lastGeneratedAt: now },
      });

      await this.auditLogService.record({
        entity: 'DonationList',
        entityId: list.id,
        donationListId: list.id,
        eventType: 'DONATION_LIST_CREATED_FROM_TEMPLATE',
        nodeId: list.nodeId,
        newData: { templateId: template.id, templateName: template.name },
      });
      await this.notificationsService.notifyNearbyNgos(list, template.donorOrganization.addressId);
      generated += 1;
    }

    if (generated > 0) {
      this.logger.log(`${generated} doação(ões) publicada(s) a partir de modelos recorrentes.`);
    }
  }

  /**
   * Devida quando já passou da hora marcada de hoje, o dia bate com a
   * recorrência e ainda não foi gerada hoje.
   */
  private isDue(template: DonationTemplate, now: Date): boolean {
    if (now.getHours() < template.hourOfDay) return false;

    const weekday = now.getDay();
    if (template.recurrence === DonationRecurrence.WEEKDAYS && (weekday === 0 || weekday === 6)) return false;
    if (template.recurrence === DonationRecurrence.WEEKLY && weekday !== (template.weekday ?? 1)) return false;

    if (!template.lastGeneratedAt) return true;
    return !this.isSameDay(template.lastGeneratedAt, now);
  }

  private isSameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
    );
  }
}
