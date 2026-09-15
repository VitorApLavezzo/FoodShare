import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { LeaderLockService } from '../../common/leader-lock.service';
import { ReservationsService } from './reservations.service';

@Injectable()
export class ReservationsExpirationJob {
  private readonly logger = new Logger(ReservationsExpirationJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLogService: AuditLogService,
    private readonly leaderLock: LeaderLockService,
    private readonly reservationsService: ReservationsService,
  ) {}

  /**
   * Sem isso, uma reserva que a ONG nunca retira segura a quantidade para
   * sempre: o item fica FULLY_RESERVED, ninguém mais consegue pegar e a comida
   * se perde. Passado o prazo de retirada mais uma tolerância, a reserva é
   * marcada como EXPIRED e a quantidade volta para a lista.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireAbandonedReservations() {
    await this.leaderLock.runExclusively('reservations-expiration', () => this.run());
  }

  private async run() {
    const graceMinutes = this.config.get<number>('reservations.pickupGraceMinutes') ?? 120;
    const cutoff = new Date(Date.now() - graceMinutes * 60_000);

    const abandoned = await this.prisma.reservation.findMany({
      where: {
        status: ReservationStatus.ACTIVE,
        donationList: { pickupDeadline: { lt: cutoff } },
      },
      include: { items: true },
    });

    if (abandoned.length === 0) return;

    for (const reservation of abandoned) {
      await this.reservationsService.expireReservation(reservation);
      await this.auditLogService.record({
        entity: 'Reservation',
        entityId: reservation.id,
        donationListId: reservation.donationListId,
        eventType: 'RESERVATION_EXPIRED',
        nodeId: reservation.nodeId,
        newData: { status: ReservationStatus.EXPIRED },
      });
    }

    this.logger.log(
      `${abandoned.length} reserva(s) expirada(s) por não retirada (tolerância de ${graceMinutes}min).`,
    );
  }
}
