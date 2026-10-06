import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { recomputeDonationListStatus } from '../donations/donation-list-status';

// remainingQuantity vem como texto do $queryRaw: converter para Prisma.Decimal
// explicitamente evita depender de como o driver mapeia NUMERIC.
interface LockedItemRow {
  id: string;
  foodName: string;
  unit: string;
  remainingQuantity: string;
  status: DonationItemStatus;
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

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

    const itemIds = dto.items.map((i) => i.donationItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_ITEM',
        message: 'Item duplicado no pedido.',
      });
    }

    // Tudo que decide a reserva (status da lista, validade, disponibilidade e a
    // regra de aceite parcial) é lido DENTRO da transação, sobre linhas já
    // travadas — ler antes abriria janela para decidir com dado velho.
    const { reservation, conversation, donorOrganizationId } = await this.prisma.$transaction(async (tx) => {
      const donationList = await tx.donationList.findFirst({
        where: { id: dto.donationListId, deletedAt: null },
      });
      if (!donationList) {
        throw new NotFoundException({
          code: 'DONATION_NOT_FOUND',
          message: 'Doação não encontrada.',
        });
      }
      if (donationList.expiresAt <= new Date()) {
        throw new ConflictException({
          code: 'DONATION_EXPIRED',
          message: 'Esta doação já expirou.',
        });
      }
      if (donationList.status !== DonationListStatus.OPEN) {
        throw new ConflictException({
          code: 'DONATION_NOT_AVAILABLE',
          message: 'Esta lista de doação não está mais disponível.',
        });
      }

      // status = 'AVAILABLE' (e não "!= CANCELLED"): item esgotado não entra no
      // lock, então pedir um item já reservado falha aqui em vez de virar uma
      // reserva de quantidade zero.
      const rows = await tx.$queryRaw<LockedItemRow[]>(
        Prisma.sql`SELECT id, "foodName", unit, "remainingQuantity"::text AS "remainingQuantity", status
                   FROM donation_items
                   WHERE id = ANY(${itemIds})
                     AND "donationListId" = ${donationList.id}
                     AND status = 'AVAILABLE'
                   ORDER BY id
                   FOR UPDATE`,
      );
      if (rows.length !== itemIds.length) {
        throw new ConflictException({
          code: 'ITEM_NOT_AVAILABLE',
          message: 'Um ou mais itens não estão mais disponíveis.',
        });
      }

      const reservationItemsData = dto.items.map((requested) => {
        const row = rows.find((r) => r.id === requested.donationItemId)!;
        const remaining = new Prisma.Decimal(row.remainingQuantity);
        const wanted = requested.quantity !== undefined ? new Prisma.Decimal(requested.quantity) : remaining;

        // A mensagem identifica o alimento pelo nome, não pelo id: o texto vai
        // direto para a tela da ONG, e um uuid ali não diz nada a quem está
        // tentando entender qual item precisa ajustar.
        if (wanted.lte(0)) {
          throw new BadRequestException({
            code: 'INVALID_QUANTITY',
            message: `A quantidade reservada de "${row.foodName}" deve ser maior que zero.`,
            itemId: row.id,
          });
        }
        if (wanted.gt(remaining)) {
          throw new ConflictException({
            code: 'INSUFFICIENT_QUANTITY',
            message: `Só restam ${remaining.toString()} ${row.unit} de "${row.foodName}" — ajuste a quantidade.`,
            itemId: row.id,
            available: remaining.toNumber(),
          });
        }
        return { donationItemId: row.id, quantity: wanted, remaining };
      });

      if (!donationList.allowPartial) {
        await this.assertCoversAllAvailableItems(tx, donationList.id, reservationItemsData);
      }

      const reservation = await tx.reservation.create({
        data: {
          donationListId: donationList.id,
          ngoOrganizationId: ngoOrganization.id,
          pickupCode: generatePickupCode(),
          nodeId: user.nodeId,
          items: {
            create: reservationItemsData.map((i) => ({
              donationItemId: i.donationItemId,
              quantity: i.quantity,
            })),
          },
        },
        include: { items: true },
      });

      for (const requested of reservationItemsData) {
        const newRemaining = requested.remaining.minus(requested.quantity);
        await tx.donationItem.update({
          where: { id: requested.donationItemId },
          data: {
            remainingQuantity: newRemaining,
            status: newRemaining.lte(0) ? DonationItemStatus.FULLY_RESERVED : DonationItemStatus.AVAILABLE,
            version: { increment: 1 },
          },
        });
      }

      await recomputeDonationListStatus(tx, donationList.id);

      const conversation = await this.chatService.createConversationForReservation(
        tx,
        reservation.id,
        donationList.id,
      );

      // Evento no outbox dentro da mesma transação: se o processo cair entre o
      // commit e a publicação, o cron de reenvio ainda encontra a linha.
      await this.syncService.publishEvent('DONATION_RESERVED', donationList.id, reservation, tx);

      return {
        reservation,
        conversation,
        donorOrganizationId: donationList.donorOrganizationId,
      };
    });

    // Efeitos colaterais best-effort: a reserva já commitou, então uma falha
    // aqui não pode virar 500 para a ONG (antes virava, e ainda deixava a
    // reserva sem conversa).
    void this.afterReserve(user, reservation, conversation, donorOrganizationId, ngoOrganization.id);

    return { ...reservation, conversationId: conversation.id };
  }

  private async afterReserve(
    user: AuthenticatedUser,
    reservation: { id: string; donationListId: string },
    conversation: { id: string },
    donorOrganizationId: string,
    ngoOrganizationId: string,
  ) {
    try {
      await this.auditLogService.record({
        entity: 'Reservation',
        entityId: reservation.id,
        donationListId: reservation.donationListId,
        eventType: 'DONATION_RESERVED',
        userId: user.id,
        nodeId: user.nodeId,
        newData: reservation,
      });
      this.chatService.notifyConversationCreated({
        conversationId: conversation.id,
        reservationId: reservation.id,
        donationListId: reservation.donationListId,
        donorOrganizationId,
        ngoOrganizationId,
      });
      // O evento de sincronização desta reserva foi gravado dentro da transação
      // e só vai para o stream no próximo ciclo do cron. O aviso para as telas
      // não pode esperar isso: sem ele, o saldo do item continuaria o antigo na
      // tela do doador por até 30s.
      this.syncService.broadcastChange('DONATION_RESERVED', reservation.donationListId);
    } catch (err) {
      this.logger.error(
        `Efeito pós-commit da reserva ${reservation.id} falhou (a reserva foi criada normalmente).`,
        err as Error,
      );
    }
  }

  async cancel(user: AuthenticatedUser, reservationId: string) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        include: { items: true },
      });
      if (!reservation) {
        throw new NotFoundException({
          code: 'RESERVATION_NOT_FOUND',
          message: 'Reserva não encontrada.',
        });
      }

      if (user.role !== 'ADMIN') {
        const isOwner = await tx.organizationUser.findFirst({
          where: {
            userId: user.id,
            organizationId: reservation.ngoOrganizationId,
          },
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

      const updated = await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CANCELLED, cancelledAt: new Date() },
      });

      await this.releaseReservationItems(tx, reservation.donationListId, reservation.items);
      await recomputeDonationListStatus(tx, reservation.donationListId);

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
      // Limite de segurança alimentar: passada a validade, a retirada não pode
      // mais ser confirmada. O prazo de retirada em si é tratado pelo job de
      // expiração de reservas, que dá uma tolerância antes de liberar o item.
      if (reservation.donationList.expiresAt <= new Date()) {
        throw new ConflictException({
          code: 'DONATION_EXPIRED',
          message: 'Esta doação venceu e não pode mais ser retirada.',
        });
      }

      if (user.role !== 'ADMIN') {
        const [isDonorOwner, isNgoOwner] = await Promise.all([
          tx.organizationUser.findFirst({
            where: {
              userId: user.id,
              organizationId: reservation.donationList.donorOrganizationId,
            },
          }),
          tx.organizationUser.findFirst({
            where: {
              userId: user.id,
              organizationId: reservation.ngoOrganizationId,
            },
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
        data: {
          reservationId: reservation.id,
          confirmedByUserId: user.id,
          nodeId: user.nodeId,
        },
      });

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.COMPLETED },
      });
      await tx.organization.updateMany({
        where: {
          id: {
            in: [reservation.ngoOrganizationId, reservation.donationList.donorOrganizationId],
          },
        },
        data: { completedPickupCount: { increment: 1 } },
      });

      await recomputeDonationListStatus(tx, reservation.donationListId);

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

    const where: Prisma.ReservationWhereInput =
      user.role === 'ADMIN'
        ? {}
        : user.role === 'NGO'
          ? { ngoOrganization: { users: { some: { userId: user.id } } } }
          : // DONOR: reservas feitas sobre as próprias doações.
            { donationList: { donorOrganization: { users: { some: { userId: user.id } } } } };

    const reservations = await this.prisma.reservation.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
    });

    return reservations.map(({ conversation, ...reservation }) => ({
      ...reservation,
      conversationId: conversation?.id,
    }));
  }

  /**
   * Marca uma reserva como não retirada e devolve a quantidade à lista.
   * Chamado pelo job de expiração — por isso não exige usuário autenticado.
   */
  async expireReservation(reservation: {
    id: string;
    donationListId: string;
    items: { donationItemId: string; quantity: Prisma.Decimal }[];
  }) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.reservation.findUnique({
        where: { id: reservation.id },
      });
      if (!current || current.status !== ReservationStatus.ACTIVE) return;

      await tx.reservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.EXPIRED },
      });
      // Reserva que segurou comida e não foi retirada conta contra a ONG: é o
      // que permite ao doador enxergar com quem está combinando.
      await tx.organization.update({
        where: { id: current.ngoOrganizationId },
        data: { noShowCount: { increment: 1 } },
      });
      await this.releaseReservationItems(tx, reservation.donationListId, reservation.items);
      await recomputeDonationListStatus(tx, reservation.donationListId);
    });
  }

  /**
   * Devolve as quantidades de uma reserva encerrada aos itens de origem. Um item
   * cancelado pelo doador ou já expirado NÃO volta a ficar disponível — devolver
   * a quantidade nesse caso reabriria uma doação que não existe mais.
   */
  private async releaseReservationItems(
    tx: Prisma.TransactionClient,
    donationListId: string,
    items: { donationItemId: string; quantity: Prisma.Decimal }[],
  ) {
    const itemIds = items.map((i) => i.donationItemId);
    const locked = await tx.$queryRaw<LockedItemRow[]>(
      Prisma.sql`SELECT id, "foodName", unit, "remainingQuantity"::text AS "remainingQuantity", status
                 FROM donation_items
                 WHERE id = ANY(${itemIds})
                 ORDER BY id
                 FOR UPDATE`,
    );

    const list = await tx.donationList.findUniqueOrThrow({
      where: { id: donationListId },
    });
    const listIsOver =
      list.expiresAt <= new Date() ||
      list.status === DonationListStatus.CANCELLED ||
      list.status === DonationListStatus.EXPIRED;

    for (const item of items) {
      const current = locked.find((l) => l.id === item.donationItemId);
      if (!current) continue;

      const isTerminal =
        current.status === DonationItemStatus.CANCELLED || current.status === DonationItemStatus.EXPIRED;

      await tx.donationItem.update({
        where: { id: item.donationItemId },
        data: {
          remainingQuantity: { increment: item.quantity },
          status: isTerminal
            ? current.status
            : listIsOver
              ? DonationItemStatus.EXPIRED
              : DonationItemStatus.AVAILABLE,
          version: { increment: 1 },
        },
      });
    }
  }

  /**
   * Lista com allowPartial=false: o pedido precisa cobrir TODOS os itens ainda
   * disponíveis, cada um pela quantidade inteira. Consultado dentro da transação
   * (as linhas pedidas já estão travadas) para não decidir sobre dado velho.
   */
  private async assertCoversAllAvailableItems(
    tx: Prisma.TransactionClient,
    donationListId: string,
    requested: {
      donationItemId: string;
      quantity: Prisma.Decimal;
      remaining: Prisma.Decimal;
    }[],
  ) {
    const availableItems = await tx.donationItem.findMany({
      where: { donationListId, status: DonationItemStatus.AVAILABLE },
      select: { id: true },
    });
    const requestedIds = new Set(requested.map((r) => r.donationItemId));

    const coversAll =
      availableItems.length === requested.length && availableItems.every((item) => requestedIds.has(item.id));
    if (!coversAll) {
      throw new ConflictException({
        code: 'PARTIAL_NOT_ALLOWED',
        message:
          'O doador não permite aceite parcial: é preciso reservar todos os itens disponíveis da lista.',
      });
    }

    for (const item of requested) {
      if (!item.quantity.eq(item.remaining)) {
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
