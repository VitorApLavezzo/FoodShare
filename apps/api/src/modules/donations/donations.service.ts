import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApprovalStatus,
  DonationItemStatus,
  DonationList,
  DonationListStatus,
  OrganizationKind,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { QueryDonationsDto } from './dto/query-donations.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { SyncService } from '../sync/sync.service';
import { NotificationsService } from '../notifications/notifications.service';

const EDITABLE_STATUSES: DonationListStatus[] = [DonationListStatus.OPEN];

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
    this.assertValidDates(dto.availableAt, dto.pickupDeadline, dto.expiresAt);

    const donationList = await this.prisma.donationList.create({
      data: {
        donorOrganizationId: organization.id,
        nodeId: user.nodeId,
        allowPartial: dto.allowPartial,
        notes: dto.notes,
        availableAt: new Date(dto.availableAt),
        pickupDeadline: new Date(dto.pickupDeadline),
        expiresAt: new Date(dto.expiresAt),
        items: {
          create: dto.items.map((item) => ({
            foodName: item.foodName,
            category: item.category,
            description: item.description,
            quantity: item.quantity,
            remainingQuantity: item.quantity,
            unit: item.unit,
            batch: item.batch,
            storageCondition: item.storageCondition,
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

    if (user.role === 'DONOR') {
      donorOrganizationWhere.users = { some: { userId: user.id } };
    } else if (user.role === 'NGO') {
      donorOrganizationWhere.approvalStatus = ApprovalStatus.APPROVED;
    }
    // ADMIN: sem restrição de posse.

    if (query.city) {
      donorOrganizationWhere.address = { city: { equals: query.city, mode: 'insensitive' } };
    }

    const where: Prisma.DonationListWhereInput = {
      deletedAt: null,
      donorOrganization: donorOrganizationWhere,
    };

    if (user.role === 'NGO') {
      where.status = { in: [DonationListStatus.OPEN] };
      where.expiresAt = { gt: new Date() };
    }

    if (query.category || query.search) {
      where.items = {
        some: {
          ...(query.category ? { category: query.category } : {}),
          ...(query.search ? { foodName: { contains: query.search, mode: 'insensitive' } } : {}),
        },
      };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.donationList.findMany({
        where,
        include: { donorOrganization: { include: { address: true } }, items: true },
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
      include: { donorOrganization: { include: { address: true } }, items: true },
    });
    if (!donationList) {
      throw new NotFoundException({ code: 'DONATION_NOT_FOUND', message: 'Doação não encontrada.' });
    }

    if (user.role === 'ADMIN') return donationList;

    const isOwner = await this.isOwnerOfDonationList(user.id, donationList);
    if (isOwner) return donationList;

    const visibleToNgo =
      donationList.status === DonationListStatus.OPEN &&
      donationList.donorOrganization.approvalStatus === ApprovalStatus.APPROVED;
    if (user.role === 'NGO' && visibleToNgo) return donationList;

    throw new ForbiddenException({
      code: 'FORBIDDEN_DONATION_ACCESS',
      message: 'Você não tem acesso a esta doação.',
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDonationDto) {
    const donationList = await this.getOwnedEditableDonationList(user, id);

    const availableAt = dto.availableAt ?? donationList.availableAt.toISOString();
    const pickupDeadline = dto.pickupDeadline ?? donationList.pickupDeadline.toISOString();
    const expiresAt = dto.expiresAt ?? donationList.expiresAt.toISOString();
    this.assertValidDates(availableAt, pickupDeadline, expiresAt);

    const updated = await this.prisma.donationList.update({
      where: { id: donationList.id },
      data: {
        notes: dto.notes,
        availableAt: dto.availableAt ? new Date(dto.availableAt) : undefined,
        pickupDeadline: dto.pickupDeadline ? new Date(dto.pickupDeadline) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        version: { increment: 1 },
      },
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

  async cancel(user: AuthenticatedUser, id: string) {
    const donationList = await this.getOwnedEditableDonationList(user, id);

    const [updated] = await this.prisma.$transaction([
      this.prisma.donationList.update({
        where: { id: donationList.id },
        data: { status: DonationListStatus.CANCELLED, version: { increment: 1 } },
      }),
      this.prisma.donationItem.updateMany({
        where: { donationListId: donationList.id, status: DonationItemStatus.AVAILABLE },
        data: { status: DonationItemStatus.CANCELLED },
      }),
    ]);

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

    return updated;
  }

  private async getOwnedEditableDonationList(user: AuthenticatedUser, id: string) {
    const donationList = await this.prisma.donationList.findFirst({
      where: { id, deletedAt: null },
      include: { items: true },
    });
    if (!donationList) {
      throw new NotFoundException({ code: 'DONATION_NOT_FOUND', message: 'Doação não encontrada.' });
    }

    const isOwner = user.role === 'ADMIN' || (await this.isOwnerOfDonationList(user.id, donationList));
    if (!isOwner) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DONATION_ACCESS',
        message: 'Você não tem acesso a esta doação.',
      });
    }

    if (!EDITABLE_STATUSES.includes(donationList.status)) {
      throw new BadRequestException({
        code: 'DONATION_NOT_EDITABLE',
        message: 'Esta doação não pode mais ser alterada (já reservada, retirada ou encerrada).',
      });
    }

    const anyItemAlreadyReserved = donationList.items.some(
      (item) => item.remainingQuantity < item.quantity,
    );
    if (anyItemAlreadyReserved) {
      throw new BadRequestException({
        code: 'DONATION_PARTIALLY_RESERVED',
        message: 'Esta lista já possui itens reservados e não pode mais ser alterada ou cancelada por inteiro.',
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

  private assertValidDates(availableAt: string, pickupDeadline: string, expiresAt: string) {
    const available = new Date(availableAt);
    const deadline = new Date(pickupDeadline);
    const expires = new Date(expiresAt);

    if (deadline <= available) {
      throw new BadRequestException({
        code: 'INVALID_PICKUP_DEADLINE',
        message: 'O prazo de retirada deve ser posterior ao início da disponibilidade.',
      });
    }
    if (deadline > expires) {
      throw new BadRequestException({
        code: 'INVALID_PICKUP_DEADLINE',
        message: 'O prazo de retirada não pode ser depois da validade do alimento.',
      });
    }
    if (expires <= new Date()) {
      throw new BadRequestException({
        code: 'INVALID_EXPIRATION',
        message: 'A validade informada já está no passado.',
      });
    }
  }
}
