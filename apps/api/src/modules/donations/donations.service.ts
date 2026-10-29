import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApprovalStatus,
  DonationItemStatus,
  DonationList,
  DonationListStatus,
  OrganizationKind,
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { QueryDonationsDto } from './dto/query-donations.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { SyncService } from '../sync/sync.service';
import { NotificationsService } from '../notifications/notifications.service';
import { assertValidDonationDates, latestItemDates, resolveItemDates } from './donation-dates';

const EDITABLE_STATUSES: DonationListStatus[] = [DonationListStatus.OPEN];
// Cancelar vale também para a lista já toda comprometida: a comida é do doador,
// e travar o cancelamento só porque alguém reservou deixava quem teve um
// imprevisto (cozinha fechada, alimento que estragou) sem saída nenhuma.
const CANCELLABLE_STATUSES: DonationListStatus[] = [
  DonationListStatus.OPEN,
  DonationListStatus.FULLY_RESERVED,
];

@Injectable()
export class DonationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly syncService: SyncService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateDonationDto) {
    const organization = await this.getApprovedDonorOrganization(user.id);
    const availableAt = new Date(dto.availableAt);
    const itemDates = resolveItemDates(dto);
    assertValidDonationDates(
      availableAt,
      new Date(),
      dto.items.map((item, index) => ({ foodName: item.foodName, ...itemDates[index] })),
    );

    const donationList = await this.prisma.donationList.create({
      data: {
        donorOrganizationId: organization.id,
        nodeId: user.nodeId,
        allowPartial: dto.allowPartial,
        notes: dto.notes,
        availableAt,
        ...latestItemDates(itemDates),
        items: {
          create: dto.items.map((item, index) => ({
            ...itemDates[index],
            foodName: item.foodName,
            category: item.category,
            description: item.description,
            quantity: item.quantity,
            remainingQuantity: item.quantity,
            unit: item.unit,
            batch: item.batch,
            storageCondition: item.storageCondition,
            imageUrl: item.imageUrl,
            allergens: item.allergens,
          })),
        },
      },
      include: { items: true },
    });

    await this.auditLogService.record({
      entity: 'DonationList',
      entityId: donationList.id,
      donationListId: donationList.id,
      eventType: 'DONATION_LIST_CREATED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: donationList,
    });
    await this.syncService.publishEvent('DONATION_LIST_CREATED', donationList.id, donationList);

    await this.notificationsService.notifyNearbyNgos(donationList, organization.addressId);

    return donationList;
  }

  async findMany(user: AuthenticatedUser, query: QueryDonationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const donorOrganizationWhere: Prisma.OrganizationWhereInput = {};
    const where: Prisma.DonationListWhereInput = {
      deletedAt: null,
      donorOrganization: donorOrganizationWhere,
    };

    if (user.role === 'DONOR') {
      donorOrganizationWhere.users = { some: { userId: user.id } };
      // Doação cancelada sai da visão do doador (o cancelamento é definitivo).
      // Filtrar aqui, e não na tela, mantém a paginação e o total corretos.
      where.status = { not: DonationListStatus.CANCELLED };
    } else if (user.role === 'NGO') {
      donorOrganizationWhere.approvalStatus = ApprovalStatus.APPROVED;
    }
    // ADMIN: sem restrição de posse.

    if (query.city) {
      donorOrganizationWhere.address = {
        city: { equals: query.city, mode: 'insensitive' },
      };
    }

    const itemWhere: Prisma.DonationItemWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.search ? { foodName: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    if (user.role === 'NGO') {
      where.status = DonationListStatus.OPEN;
      // Só aparece a lista com algum item que ainda dá para reservar e buscar
      // — e é nesse item que a busca/categoria tem de bater.
      itemWhere.status = DonationItemStatus.AVAILABLE;
      itemWhere.pickupDeadline = { gt: new Date() };
    }

    if (Object.keys(itemWhere).length > 0) {
      where.items = { some: itemWhere };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.donationList.findMany({
        where,
        include: {
          donorOrganization: { include: { address: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.donationList.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const donationList = await this.prisma.donationList.findFirst({
      where: { id, deletedAt: null },
      include: {
        donorOrganization: { include: { address: true } },
        items: true,
      },
    });
    if (!donationList) {
      throw new NotFoundException({
        code: 'DONATION_NOT_FOUND',
        message: 'Doação não encontrada.',
      });
    }

    if (user.role === 'ADMIN') return donationList;

    const isOwner = await this.isOwnerOfDonationList(user.id, donationList);
    if (isOwner) return donationList;

    if (user.role === 'NGO') {
      const visibleToNgo =
        donationList.status === DonationListStatus.OPEN &&
        donationList.donorOrganization.approvalStatus === ApprovalStatus.APPROVED;
      if (visibleToNgo) return donationList;

      // Quem reservou continua enxergando a doação depois que ela sai de OPEN.
      // Sem isso, reservar a lista inteira levava a ONG direto a um 403 — e os
      // avisos de "doação cancelada" e "retirada confirmada" abriam numa tela
      // de "sem acesso".
      const reservation = await this.prisma.reservation.findFirst({
        where: { donationListId: donationList.id, ngoOrganization: { users: { some: { userId: user.id } } } },
        select: { id: true },
      });
      if (reservation) return donationList;
    }

    throw new ForbiddenException({
      code: 'FORBIDDEN_DONATION_ACCESS',
      message: 'Você não tem acesso a esta doação.',
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDonationDto) {
    const donationList = await this.getOwnedEditableDonationList(user, id);

    const unknownItem = dto.items?.find((patch) => !donationList.items.some((item) => item.id === patch.id));
    if (unknownItem) {
      throw new BadRequestException({
        code: 'ITEM_NOT_FOUND',
        message: 'Um dos itens informados não pertence a esta doação.',
      });
    }

    // Precedência: data do próprio item > data da lista (vale para todos) > a atual.
    const items = donationList.items.map((item) => {
      const patch = dto.items?.find((p) => p.id === item.id);
      return {
        foodName: item.foodName,
        pickupDeadline: patch?.pickupDeadline ?? dto.pickupDeadline ?? item.pickupDeadline.toISOString(),
        expiresAt: patch?.expiresAt ?? dto.expiresAt ?? item.expiresAt.toISOString(),
      };
    });
    const itemDates = resolveItemDates({ allowPartial: donationList.allowPartial, items });
    const availableAt = dto.availableAt ? new Date(dto.availableAt) : donationList.availableAt;
    assertValidDonationDates(
      availableAt,
      donationList.createdAt,
      items.map((item, index) => ({ foodName: item.foodName, ...itemDates[index] })),
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const [index, item] of donationList.items.entries()) {
        const dates = itemDates[index];
        if (
          dates.pickupDeadline.getTime() === item.pickupDeadline.getTime() &&
          dates.expiresAt.getTime() === item.expiresAt.getTime()
        ) {
          continue;
        }
        await tx.donationItem.update({
          where: { id: item.id },
          data: { ...dates, version: { increment: 1 } },
        });
      }

      return tx.donationList.update({
        where: { id: donationList.id },
        data: {
          notes: dto.notes,
          availableAt,
          ...latestItemDates(itemDates),
          version: { increment: 1 },
        },
        include: { items: true },
      });
    });

    await this.auditLogService.record({
      entity: 'DonationList',
      entityId: updated.id,
      donationListId: updated.id,
      eventType: 'DONATION_LIST_UPDATED',
      userId: user.id,
      nodeId: user.nodeId,
      previousData: donationList,
      newData: updated,
    });
    await this.syncService.publishEvent('DONATION_LIST_UPDATED', updated.id, updated);

    return updated;
  }

  /**
   * Tira a doação inteira do ar — inclusive o que já estava reservado.
   *
   * Antes o cancelamento só alcançava o saldo ainda disponível, para preservar
   * o combinado com quem reservou; na prática isso deixava o doador preso a uma
   * entrega que ele não tinha mais como honrar. A regra agora é a inversa e
   * mais honesta: o doador cancela, as reservas ativas caem junto e cada ONG
   * afetada é avisada na hora. A reserva cancelada pelo doador NÃO conta como
   * falta da ONG (noShowCount), que não deu causa nenhuma.
   */
  async cancel(user: AuthenticatedUser, id: string) {
    const donationList = await this.getOwnedEditableDonationList(user, id, {
      allowPartiallyReserved: true,
      statuses: CANCELLABLE_STATUSES,
    });

    const { updated, affectedNgoIds } = await this.prisma.$transaction(async (tx) => {
      const activeReservations = await tx.reservation.findMany({
        where: {
          donationListId: donationList.id,
          status: ReservationStatus.ACTIVE,
        },
        select: { id: true, ngoOrganizationId: true, items: { select: { donationItemId: true } } },
      });
      const heldItemIds = activeReservations.flatMap((r) => r.items.map((i) => i.donationItemId));

      if (activeReservations.length > 0) {
        await tx.reservation.updateMany({
          where: { id: { in: activeReservations.map((r) => r.id) } },
          data: {
            status: ReservationStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
      }

      // Nada volta para a prateleira: item livre e item preso a uma reserva
      // ativa terminam os dois em CANCELLED. A exceção é o item esgotado sem
      // reserva ativa — ele já foi todo retirado, e marcá-lo como cancelado
      // apagava dos relatórios uma entrega que aconteceu de verdade.
      await tx.donationItem.updateMany({
        where: {
          donationListId: donationList.id,
          OR: [
            { status: DonationItemStatus.AVAILABLE },
            { status: DonationItemStatus.FULLY_RESERVED, id: { in: heldItemIds } },
          ],
        },
        data: { status: DonationItemStatus.CANCELLED },
      });

      const updated = await tx.donationList.update({
        where: { id: donationList.id },
        data: {
          status: DonationListStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      return {
        updated,
        affectedNgoIds: [...new Set(activeReservations.map((r) => r.ngoOrganizationId))],
      };
    });

    await this.auditLogService.record({
      entity: 'DonationList',
      entityId: updated.id,
      donationListId: updated.id,
      eventType: 'DONATION_LIST_CANCELLED',
      userId: user.id,
      nodeId: user.nodeId,
      previousData: donationList,
      newData: updated,
    });
    await this.syncService.publishEvent('DONATION_LIST_CANCELLED', updated.id, updated);
    await this.notificationsService.removeForDonationList(updated.id);
    // Depois do removeForDonationList: ele limpa os alertas de "doação
    // disponível" desta lista, e o aviso de cancelamento não pode ir junto.
    if (affectedNgoIds.length > 0) {
      await this.notificationsService.notifyReservationsCancelledByDonor(
        updated.id,
        affectedNgoIds,
        donationList.items.map((item) => item.foodName).join(', '),
      );
    }

    return updated;
  }

  private async getOwnedEditableDonationList(
    user: AuthenticatedUser,
    id: string,
    options: {
      allowPartiallyReserved?: boolean;
      statuses?: DonationListStatus[];
    } = {},
  ) {
    const donationList = await this.prisma.donationList.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!donationList) {
      throw new NotFoundException({
        code: 'DONATION_NOT_FOUND',
        message: 'Doação não encontrada.',
      });
    }

    const isOwner = user.role === 'ADMIN' || (await this.isOwnerOfDonationList(user.id, donationList));
    if (!isOwner) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DONATION_ACCESS',
        message: 'Você não tem acesso a esta doação.',
      });
    }

    const allowedStatuses = options.statuses ?? EDITABLE_STATUSES;
    if (!allowedStatuses.includes(donationList.status)) {
      throw new BadRequestException({
        code: 'DONATION_NOT_EDITABLE',
        message: 'Esta doação não pode mais ser alterada (já retirada, cancelada ou encerrada).',
      });
    }

    const anyItemAlreadyReserved = donationList.items.some((item) =>
      item.remainingQuantity.lessThan(item.quantity),
    );
    // Alterar datas de uma lista já reservada mudaria o combinado com quem
    // reservou; cancelar o saldo, não — por isso só o cancelamento passa aqui.
    if (anyItemAlreadyReserved && !options.allowPartiallyReserved) {
      throw new BadRequestException({
        code: 'DONATION_PARTIALLY_RESERVED',
        message:
          'Esta lista já possui itens reservados e não pode mais ser alterada ou cancelada por inteiro.',
      });
    }

    return donationList;
  }

  private async isOwnerOfDonationList(userId: string, donationList: DonationList) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId, organizationId: donationList.donorOrganizationId },
    });
    return !!link;
  }

  private async getApprovedDonorOrganization(userId: string) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId, organization: { kind: OrganizationKind.DONOR } },
      include: { organization: true },
    });

    if (!link) {
      throw new ForbiddenException({
        code: 'DONOR_ORGANIZATION_REQUIRED',
        message: 'Cadastre seu estabelecimento antes de publicar doações.',
      });
    }
    if (link.organization.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException({
        code: 'DONOR_ORGANIZATION_NOT_APPROVED',
        message: 'Seu estabelecimento ainda não foi aprovado pela administração.',
      });
    }
    return link.organization;
  }
}
