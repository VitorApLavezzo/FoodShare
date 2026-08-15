import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, DonationStatus, OrganizationKind, Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { generatePickupCode } from '../../common/pickup-code';
import { AuditLogService } from '../audit/audit-log.service';
import { SyncService } from '../sync/sync.service';

interface LockedDonationRow {
  id: string;
  status: DonationStatus;
  expiresAt: Date;
  donorOrganizationId: string;
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly syncService: SyncService,
  ) {}

  /**
   * Trava a linha da doação (SELECT ... FOR UPDATE) dentro de uma transação antes de
   * decidir se a reserva pode ser criada. Duas requisições concorrentes para a mesma
   * doação serializam nesse lock: a segunda só lê o status já como RESERVED depois que
   * a primeira commita, e falha com 409 — nunca as duas criam reserva.
   */
  async reserve(user: AuthenticatedUser, donationId: string) {
    const ngoOrganization = await this.getApprovedNgoOrganization(user.id);

    const reservation = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedDonationRow[]>(
        Prisma.sql`SELECT id, status, "expiresAt", "donorOrganizationId" FROM donations WHERE id = ${donationId} AND "deletedAt" IS NULL FOR UPDATE`,
      );
      const donation = rows[0];
      if (!donation) {
        throw new NotFoundException({ code: 'DONATION_NOT_FOUND', message: 'Doação não encontrada.' });
      }
      if (donation.expiresAt <= new Date()) {
        throw new ConflictException({ code: 'DONATION_EXPIRED', message: 'Esta doação já expirou.' });
      }
      if (donation.status !== DonationStatus.AVAILABLE) {
        throw new ConflictException({
          code: 'DONATION_ALREADY_RESERVED',
          message: 'Esta doação já foi reservada.',
        });
      }

      const reservation = await tx.reservation.create({
        data: {
          donationId,
          ngoOrganizationId: ngoOrganization.id,
          pickupCode: generatePickupCode(),
          nodeId: user.nodeId,
        },
      });

      await tx.donation.update({
        where: { id: donationId },
        data: { status: DonationStatus.RESERVED, version: { increment: 1 } },
      });

      return reservation;
    });

    await this.auditLogService.record({
      entity: 'Reservation',
      entityId: reservation.id,
      donationId,
      eventType: 'DONATION_RESERVED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: reservation,
    });
    await this.syncService.publishEvent('DONATION_RESERVED', donationId, reservation);

    return reservation;
  }

  async cancel(user: AuthenticatedUser, reservationId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id: reservationId } });
      if (!reservation) {
        throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'Reserva não encontrada.' });
      }

      if (user.role !== 'ADMIN') {
        const isOwner = await tx.organizationUser.findFirst({
          where: { userId: user.id, organizationId: reservation.ngoOrganizationId },
        });
        if (!isOwner) {
          throw new ForbiddenException({
            code: 'FORBIDDEN_RESERVATION_ACCESS',
            message: 'Você não tem acesso a esta reserva.',
          });
        }
      }

      if (reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException({
          code: 'RESERVATION_NOT_ACTIVE',
          message: 'Esta reserva não está mais ativa.',
        });
      }

      // Trava a doação para evitar corrida com uma confirmação de retirada em andamento.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM donations WHERE id = ${reservation.donationId} FOR UPDATE`,
      );

      const updated = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
      });

      await tx.donation.update({
        where: { id: reservation.donationId },
        data: { status: DonationStatus.AVAILABLE, version: { increment: 1 } },
      });

      return updated;
    });

    await this.auditLogService.record({
      entity: 'Reservation',
      entityId: updated.id,
      donationId: updated.donationId,
      eventType: 'RESERVATION_CANCELLED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: updated,
    });
    await this.syncService.publishEvent('RESERVATION_CANCELLED', updated.donationId, updated);

    return updated;
  }

  /**
   * Confirma a retirada presencial: quem estiver com o código (doador ou ONG da
   * reserva) pode submetê-lo. Isso modela o "handshake" físico descrito na seção 14
   * da especificação (ONG apresenta o código, o estabelecimento confirma), sem
   * assumir qual dos dois lados literalmente aperta o botão.
   *
   * Simplificação documentada: o status intermediário PICKUP_PENDING não é usado
   * como um passo manual separado nesta fase — a doação vai direto de RESERVED
   * para PICKED_UP na confirmação. O valor do enum continua reservado para uso
   * futuro (ex.: notificação "pronto para retirada").
   */
  async confirmPickup(user: AuthenticatedUser, donationId: string, pickupCode: string) {
    const pickup = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedDonationRow[]>(
        Prisma.sql`SELECT id, status, "expiresAt", "donorOrganizationId" FROM donations WHERE id = ${donationId} AND "deletedAt" IS NULL FOR UPDATE`,
      );
      const donation = rows[0];
      if (!donation) {
        throw new NotFoundException({ code: 'DONATION_NOT_FOUND', message: 'Doação não encontrada.' });
      }

      const reservation = await tx.reservation.findFirst({
        where: { donationId, status: ReservationStatus.ACTIVE },
      });
      if (!reservation) {
        throw new BadRequestException({
          code: 'NO_ACTIVE_RESERVATION',
          message: 'Esta doação não possui uma reserva ativa para confirmar retirada.',
        });
      }

      if (user.role !== 'ADMIN') {
        const [isDonorOwner, isNgoOwner] = await Promise.all([
          tx.organizationUser.findFirst({
            where: { userId: user.id, organizationId: donation.donorOrganizationId },
          }),
          tx.organizationUser.findFirst({
            where: { userId: user.id, organizationId: reservation.ngoOrganizationId },
          }),
        ]);
        if (!isDonorOwner && !isNgoOwner) {
          throw new ForbiddenException({
            code: 'FORBIDDEN_RESERVATION_ACCESS',
            message: 'Você não tem acesso a esta reserva.',
          });
        }
      }

      if (reservation.pickupCode !== pickupCode) {
        throw new BadRequestException({
          code: 'INVALID_PICKUP_CODE',
          message: 'Código de retirada inválido.',
        });
      }

      const pickup = await tx.pickup.create({
        data: { reservationId: reservation.id, confirmedByUserId: user.id, nodeId: user.nodeId },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.COMPLETED },
      });

      await tx.donation.update({
        where: { id: donationId },
        data: { status: DonationStatus.PICKED_UP, version: { increment: 1 } },
      });

      return pickup;
    });

    await this.auditLogService.record({
      entity: 'Pickup',
      entityId: pickup.id,
      donationId,
      eventType: 'PICKUP_CONFIRMED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: pickup,
    });
    await this.syncService.publishEvent('PICKUP_CONFIRMED', donationId, pickup);

    return pickup;
  }

  async findMany(user: AuthenticatedUser) {
    if (user.role === 'ADMIN') {
      return this.prisma.reservation.findMany({
        include: { donation: true, ngoOrganization: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (user.role === 'NGO') {
      return this.prisma.reservation.findMany({
        where: { ngoOrganization: { users: { some: { userId: user.id } } } },
        include: { donation: true, ngoOrganization: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // DONOR: reservas feitas sobre as próprias doações.
    return this.prisma.reservation.findMany({
      where: { donation: { donorOrganization: { users: { some: { userId: user.id } } } } },
      include: { donation: true, ngoOrganization: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getApprovedNgoOrganization(userId: string) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId, organization: { kind: OrganizationKind.NGO } },
      include: { organization: true },
    });

    if (!link) {
      throw new ForbiddenException({
        code: 'NGO_ORGANIZATION_REQUIRED',
        message: 'Cadastre sua ONG antes de reservar doações.',
      });
    }
    if (link.organization.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException({
        code: 'NGO_ORGANIZATION_NOT_APPROVED',
        message: 'Sua ONG ainda não foi aprovada pela administração.',
      });
    }
    return link.organization;
  }
}
