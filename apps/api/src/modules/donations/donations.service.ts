import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApprovalStatus, Donation, DonationStatus, OrganizationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { QueryDonationsDto } from './dto/query-donations.dto';
import { AuditLogService } from '../audit/audit-log.service';
import { SyncService } from '../sync/sync.service';

const EDITABLE_STATUSES: DonationStatus[] = [DonationStatus.AVAILABLE];

@Injectable()
export class DonationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly syncService: SyncService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateDonationDto) {
    const organization = await this.getApprovedDonorOrganization(user.id);
    this.assertValidDates(dto.availableAt, dto.pickupDeadline, dto.expiresAt);

    const donation = await this.prisma.donation.create({
      data: {
        donorOrganizationId: organization.id,
        nodeId: user.nodeId,
        foodName: dto.foodName,
        category: dto.category,
        description: dto.description,
        quantity: dto.quantity,
        unit: dto.unit,
        batch: dto.batch,
        storageCondition: dto.storageCondition,
        notes: dto.notes,
        availableAt: new Date(dto.availableAt),
        pickupDeadline: new Date(dto.pickupDeadline),
        expiresAt: new Date(dto.expiresAt),
      },
    });

    await this.auditLogService.record({
      entity: 'Donation',
      entityId: donation.id,
      donationId: donation.id,
      eventType: 'DONATION_CREATED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: donation,
    });
    await this.syncService.publishEvent('DONATION_CREATED', donation.id, donation);

    return donation;
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

    const where: Prisma.DonationWhereInput = {
      deletedAt: null,
      donorOrganization: donorOrganizationWhere,
    };

    if (user.role === 'NGO') {
      where.status = DonationStatus.AVAILABLE;
      where.expiresAt = { gt: new Date() };
    }

    if (query.category) where.category = query.category;
    if (query.search) where.foodName = { contains: query.search, mode: 'insensitive' };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.donation.findMany({
        where,
        include: { donorOrganization: { include: { address: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.donation.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const donation = await this.prisma.donation.findFirst({
      where: { id, deletedAt: null },
      include: { donorOrganization: { include: { address: true } } },
    });
    if (!donation) {
      throw new NotFoundException({ code: 'DONATION_NOT_FOUND', message: 'Doação não encontrada.' });
    }

    if (user.role === 'ADMIN') return donation;

    const isOwner = await this.isOwnerOfDonation(user.id, donation);
    if (isOwner) return donation;

    const visibleToNgo =
      donation.status === DonationStatus.AVAILABLE &&
      donation.donorOrganization.approvalStatus === ApprovalStatus.APPROVED;
    if (user.role === 'NGO' && visibleToNgo) return donation;

    throw new ForbiddenException({
      code: 'FORBIDDEN_DONATION_ACCESS',
      message: 'Você não tem acesso a esta doação.',
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateDonationDto) {
    const donation = await this.getOwnedEditableDonation(user, id);

    const availableAt = dto.availableAt ?? donation.availableAt.toISOString();
    const pickupDeadline = dto.pickupDeadline ?? donation.pickupDeadline.toISOString();
    const expiresAt = dto.expiresAt ?? donation.expiresAt.toISOString();
    this.assertValidDates(availableAt, pickupDeadline, expiresAt);

    const updated = await this.prisma.donation.update({
      where: { id: donation.id },
      data: {
        ...dto,
        availableAt: dto.availableAt ? new Date(dto.availableAt) : undefined,
        pickupDeadline: dto.pickupDeadline ? new Date(dto.pickupDeadline) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        version: { increment: 1 },
      },
    });

    await this.auditLogService.record({
      entity: 'Donation',
      entityId: updated.id,
      donationId: updated.id,
      eventType: 'DONATION_UPDATED',
      userId: user.id,
      nodeId: user.nodeId,
      previousData: donation,
      newData: updated,
    });
    await this.syncService.publishEvent('DONATION_UPDATED', updated.id, updated);

    return updated;
  }

  async cancel(user: AuthenticatedUser, id: string) {
    const donation = await this.getOwnedEditableDonation(user, id);
    const updated = await this.prisma.donation.update({
      where: { id: donation.id },
      data: { status: DonationStatus.CANCELLED, version: { increment: 1 } },
    });

    await this.auditLogService.record({
      entity: 'Donation',
      entityId: updated.id,
      donationId: updated.id,
      eventType: 'DONATION_CANCELLED',
      userId: user.id,
      nodeId: user.nodeId,
      previousData: donation,
      newData: updated,
    });
    await this.syncService.publishEvent('DONATION_CANCELLED', updated.id, updated);

    return updated;
  }

  private async getOwnedEditableDonation(user: AuthenticatedUser, id: string) {
    const donation = await this.prisma.donation.findFirst({ where: { id, deletedAt: null } });
    if (!donation) {
      throw new NotFoundException({ code: 'DONATION_NOT_FOUND', message: 'Doação não encontrada.' });
    }

    const isOwner = user.role === 'ADMIN' || (await this.isOwnerOfDonation(user.id, donation));
    if (!isOwner) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_DONATION_ACCESS',
        message: 'Você não tem acesso a esta doação.',
      });
    }

    if (!EDITABLE_STATUSES.includes(donation.status)) {
      throw new BadRequestException({
        code: 'DONATION_NOT_EDITABLE',
        message: 'Esta doação não pode mais ser alterada (já reservada, retirada ou encerrada).',
      });
    }

    return donation;
  }

  private async isOwnerOfDonation(userId: string, donation: Donation) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId, organizationId: donation.donorOrganizationId },
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
