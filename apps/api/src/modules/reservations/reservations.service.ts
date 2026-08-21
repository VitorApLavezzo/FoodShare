import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  DonationItemStatus,
  DonationListStatus,
  OrganizationKind,
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { generatePickupCode } from '../../common/pickup-code';
import { AuditLogService } from '../audit/audit-log.service';
import { SyncService } from '../sync/sync.service';
import { ChatService } from '../chat/chat.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

interface LockedItemRow {
  id: string;
  remainingQuantity: number;
  status: DonationItemStatus;
}

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly syncService: SyncService,
    private readonly chatService: ChatService,
  ) {}

  /**
   * Trava todas as linhas de DonationItem pedidas (SELECT ... FOR UPDATE, em
   * ordem fixa por id para evitar deadlock entre pedidos concorrentes com
   * conjuntos de itens sobrepostos) antes de decidir se a reserva pode ser
   * criada. Cada item só é concedido se a quantidade pedida couber no que
   * restou após o lock - por isso duas ONGs pedindo mais do que existe nunca
   * conseguem, juntas, reservar mais do que o total disponível.
   */
  async reserve(user: AuthenticatedUser, dto: CreateReservationDto) {
    const ngoOrganization = await this.getApprovedNgoOrganization(user.id);

    const donationList = await this.prisma.donationList.findFirst({
      where: { id: dto.donationListId, deletedAt: null },
      include: { items: true },
    });
    if (!donationList) {
      throw new NotFoundException({ code: 'DONATION_NOT_FOUND', message: 'Doação não encontrada.' });
    }
    if (donationList.expiresAt <= new Date()) {
      throw new ConflictException({ code: 'DONATION_EXPIRED', message: 'Esta doação já expirou.' });
    }
    if (donationList.status !== DonationListStatus.OPEN) {
      throw new ConflictException({
        code: 'DONATION_NOT_AVAILABLE',
        message: 'Esta lista de doação não está mais disponível.',
      });
    }

    const itemIds = dto.items.map((i) => i.donationItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException({ code: 'DUPLICATE_ITEM', message: 'Item duplicado no pedido.' });
    }
    const knownIds = new Set(donationList.items.map((i) => i.id));
    if (!itemIds.every((id) => knownIds.has(id))) {
      throw new NotFoundException({ code: 'ITEM_NOT_FOUND', message: 'Item não pertence a esta doação.' });
    }

    if (!donationList.allowPartial) {
      this.assertCoversAllAvailableItems(donationList.items, dto.items);
    }

    const reservation = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<LockedItemRow[]>(
        Prisma.sql`SELECT id, "remainingQuantity", status FROM donation_items WHERE id = ANY(${itemIds}) AND status != 'CANCELLED' ORDER BY id FOR UPDATE`,
      );
      if (rows.length !== itemIds.length) {
        throw new ConflictException({
          code: 'ITEM_NOT_AVAILABLE',
          message: 'Um ou mais itens não estão mais disponíveis.',
        });
      }

      const reservationItemsData = dto.items.map((requested) => {
        const row = rows.find((r) => r.id === requested.donationItemId)!;
        const wantedQty = requested.quantity ?? row.remainingQuantity;
        if (wantedQty > row.remainingQuantity) {
          throw new ConflictException({
            code: 'INSUFFICIENT_QUANTITY',
            message: `Quantidade indisponível para o item ${row.id}.`,
            itemId: row.id,
            available: row.remainingQuantity,
          });
        }
        return { donationItemId: row.id, quantity: wantedQty };
      });

      const reservation = await tx.reservation.create({
        data: {
          donationListId: donationList.id,
          ngoOrganizationId: ngoOrganization.id,
          pickupCode: generatePickupCode(),
          nodeId: user.nodeId,
          items: { create: reservationItemsData },
        },
        include: { items: true },
      });

      for (const requested of reservationItemsData) {
        const row = rows.find((r) => r.id === requested.donationItemId)!;
        const newRemaining = row.remainingQuantity - requested.quantity;
        await tx.donationItem.update({
          where: { id: requested.donationItemId },
          data: {
            remainingQuantity: newRemaining,
            status: newRemaining <= 0 ? DonationItemStatus.FULLY_RESERVED : DonationItemStatus.AVAILABLE,
            version: { increment: 1 },
          },
        });
      }

      const stillAvailable = await tx.donationItem.count({
        where: { donationListId: donationList.id, status: DonationItemStatus.AVAILABLE },
      });
      await tx.donationList.update({
        where: { id: donationList.id },
        data: {
          status: stillAvailable === 0 ? DonationListStatus.FULLY_RESERVED : DonationListStatus.OPEN,
          version: { increment: 1 },
        },
      });

      return reservation;
    });

    await this.auditLogService.record({
      entity: 'Reservation',
      entityId: reservation.id,
      donationListId: donationList.id,
      eventType: 'DONATION_RESERVED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: reservation,
    });
    await this.syncService.publishEvent('DONATION_RESERVED', donationList.id, reservation);

    const conversation = await this.chatService.getOrCreateConversation(reservation.id, donationList.id);

    return { ...reservation, conversationId: conversation.id };
  }

  async cancel(user: AuthenticatedUser, reservationId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { items: true },
      });
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

      const itemIds = reservation.items.map((i) => i.donationItemId);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM donation_items WHERE id = ANY(${itemIds}) ORDER BY id FOR UPDATE`,
      );

      const updated = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
      });

      for (const item of reservation.items) {
        await tx.donationItem.update({
          where: { id: item.donationItemId },
          data: {
            remainingQuantity: { increment: item.quantity },
            status: DonationItemStatus.AVAILABLE,
            version: { increment: 1 },
          },
        });
      }

      await tx.donationList.update({
        where: { id: reservation.donationListId },
        data: { status: DonationListStatus.OPEN, version: { increment: 1 } },
      });

      return updated;
    });

    await this.auditLogService.record({
      entity: 'Reservation',
      entityId: updated.id,
      donationListId: updated.donationListId,
      eventType: 'RESERVATION_CANCELLED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: updated,
    });
    await this.syncService.publishEvent('RESERVATION_CANCELLED', updated.donationListId, updated);

    return updated;
  }

  /**
   * Confirma a retirada presencial pelo código - o código de retirada já é
   * globalmente único, então identifica a reserva diretamente (não depende
   * mais de "a" doação ter no máximo uma reserva ativa: agora várias ONGs
   * podem ter reservas ativas simultâneas sobre itens diferentes da mesma
   * lista).
   */
  async confirmPickup(user: AuthenticatedUser, pickupCode: string) {
    const pickup = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { pickupCode },
        include: { donationList: true },
      });
      if (!reservation || reservation.status !== ReservationStatus.ACTIVE) {
        throw new BadRequestException({
          code: 'INVALID_PICKUP_CODE',
          message: 'Código de retirada inválido.',
        });
      }

      if (user.role !== 'ADMIN') {
        const [isDonorOwner, isNgoOwner] = await Promise.all([
          tx.organizationUser.findFirst({
            where: { userId: user.id, organizationId: reservation.donationList.donorOrganizationId },
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

      const pickup = await tx.pickup.create({
        data: { reservationId: reservation.id, confirmedByUserId: user.id, nodeId: user.nodeId },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.COMPLETED },
      });

      const [activeReservations, availableItems] = await Promise.all([
        tx.reservation.count({
          where: { donationListId: reservation.donationListId, status: ReservationStatus.ACTIVE },
        }),
        tx.donationItem.count({
          where: { donationListId: reservation.donationListId, status: DonationItemStatus.AVAILABLE },
        }),
      ]);
      if (activeReservations === 0 && availableItems === 0) {
        await tx.donationList.update({
          where: { id: reservation.donationListId },
          data: { status: DonationListStatus.CLOSED },
        });
      }

      return { pickup, donationListId: reservation.donationListId };
    });

    await this.auditLogService.record({
      entity: 'Pickup',
      entityId: pickup.pickup.id,
      donationListId: pickup.donationListId,
      eventType: 'PICKUP_CONFIRMED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: pickup.pickup,
    });
    await this.syncService.publishEvent('PICKUP_CONFIRMED', pickup.donationListId, pickup.pickup);

    return pickup.pickup;
  }

  async findMany(user: AuthenticatedUser) {
    const include = {
      donationList: true,
      ngoOrganization: true,
      items: { include: { donationItem: true } },
      conversation: true,
    } as const;

    let reservations;
    if (user.role === 'ADMIN') {
      reservations = await this.prisma.reservation.findMany({ include, orderBy: { createdAt: 'desc' } });
    } else if (user.role === 'NGO') {
      reservations = await this.prisma.reservation.findMany({
        where: { ngoOrganization: { users: { some: { userId: user.id } } } },
        include,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // DONOR: reservas feitas sobre as próprias doações.
      reservations = await this.prisma.reservation.findMany({
        where: { donationList: { donorOrganization: { users: { some: { userId: user.id } } } } },
        include,
        orderBy: { createdAt: 'desc' },
      });
    }

    return reservations.map(({ conversation, ...reservation }) => ({
      ...reservation,
      conversationId: conversation?.id,
    }));
  }

  private assertCoversAllAvailableItems(
    listItems: { id: string; status: DonationItemStatus; remainingQuantity: number }[],
    requested: { donationItemId: string; quantity?: number }[],
  ) {
    const availableItems = listItems.filter((i) => i.status === DonationItemStatus.AVAILABLE);
    const requestedIds = new Set(requested.map((r) => r.donationItemId));

    const coversAll =
      availableItems.length === requested.length &&
      availableItems.every((item) => requestedIds.has(item.id));
    if (!coversAll) {
      throw new ConflictException({
        code: 'PARTIAL_NOT_ALLOWED',
        message: 'O doador não permite aceite parcial: é preciso reservar todos os itens disponíveis da lista.',
      });
    }

    for (const item of availableItems) {
      const requestedItem = requested.find((r) => r.donationItemId === item.id)!;
      if (requestedItem.quantity !== undefined && requestedItem.quantity !== item.remainingQuantity) {
        throw new ConflictException({
          code: 'PARTIAL_NOT_ALLOWED',
          message: 'O doador não permite aceite parcial: cada item deve ser reservado por inteiro.',
        });
      }
    }
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
