import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, OrganizationKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { SyncService } from '../sync/sync.service';

type ManualApprovalStatus = Exclude<ApprovalStatus, 'PENDING'>;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly syncService: SyncService,
  ) {}

  async create(user: AuthenticatedUser, kind: OrganizationKind, dto: CreateOrganizationDto) {
    const existingLink = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organization: { kind } },
    });
    if (existingLink) {
      throw new ConflictException({
        code: 'ORGANIZATION_ALREADY_EXISTS',
        message: 'Você já possui um cadastro deste tipo.',
      });
    }

    const { address, ...orgFields } = dto;

    const organization = await this.prisma.$transaction(async (tx) => {
      const createdAddress = await tx.address.create({ data: address });
      const created = await tx.organization.create({
        data: {
          ...orgFields,
          kind,
          nodeId: user.nodeId,
          addressId: createdAddress.id,
          // Aprovação manual removida: qualquer cadastro completo já entra liberado.
          approvalStatus: ApprovalStatus.APPROVED,
        },
      });
      await tx.organizationUser.create({
        data: { organizationId: created.id, userId: user.id },
      });
      return created;
    });

    await this.auditLogService.record({
      entity: 'Organization',
      entityId: organization.id,
      eventType: kind === OrganizationKind.DONOR ? 'DONOR_REGISTERED' : 'NGO_REGISTERED',
      userId: user.id,
      nodeId: user.nodeId,
      newData: organization,
    });
    await this.syncService.publishEvent('ORGANIZATION_APPROVED', organization.id, organization);

    return organization;
  }

  async findMany(user: AuthenticatedUser, kind: OrganizationKind) {
    if (user.role === 'ADMIN') {
      return this.prisma.organization.findMany({
        where: { kind, deletedAt: null },
        include: { address: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.organization.findMany({
      where: { kind, deletedAt: null, users: { some: { userId: user.id } } },
      include: { address: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: AuthenticatedUser, kind: OrganizationKind, id: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id, kind, deletedAt: null },
      include: { address: true, users: true },
    });
    if (!organization) {
      throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND', message: 'Cadastro não encontrado.' });
    }
    this.assertCanView(user, organization);
    return organization;
  }

  async update(user: AuthenticatedUser, kind: OrganizationKind, id: string, dto: UpdateOrganizationDto) {
    const organization = await this.findOne(user, kind, id);
    this.assertCanEdit(user, organization);

    const { address, ...orgFields } = dto;

    return this.prisma.organization.update({
      where: { id: organization.id },
      data: {
        ...orgFields,
        version: { increment: 1 },
        ...(address ? { address: { update: address } } : {}),
      },
      include: { address: true },
    });
  }

  async updateApproval(
    admin: AuthenticatedUser,
    kind: OrganizationKind,
    id: string,
    status: ManualApprovalStatus,
  ) {
    const organization = await this.prisma.organization.findFirst({ where: { id, kind, deletedAt: null } });
    if (!organization) {
      throw new NotFoundException({ code: 'ORGANIZATION_NOT_FOUND', message: 'Cadastro não encontrado.' });
    }
    const updated = await this.prisma.organization.update({
      where: { id },
      data: { approvalStatus: status, version: { increment: 1 } },
    });

    await this.auditLogService.record({
      entity: 'Organization',
      entityId: updated.id,
      eventType: 'ORGANIZATION_APPROVAL_CHANGED',
      userId: admin.id,
      nodeId: admin.nodeId,
      previousData: { approvalStatus: organization.approvalStatus },
      newData: { approvalStatus: updated.approvalStatus },
    });
    if (status === ApprovalStatus.APPROVED) {
      await this.syncService.publishEvent('ORGANIZATION_APPROVED', updated.id, updated);
    }

    return updated;
  }

  private isOwner(user: AuthenticatedUser, organization: { users: { userId: string }[] }) {
    return organization.users.some((link) => link.userId === user.id);
  }

  private assertCanView(user: AuthenticatedUser, organization: { users: { userId: string }[] }) {
    if (user.role === 'ADMIN') return;
    if (!this.isOwner(user, organization)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ORGANIZATION_ACCESS',
        message: 'Você não tem acesso a este cadastro.',
      });
    }
  }

  private assertCanEdit(user: AuthenticatedUser, organization: { users: { userId: string }[] }) {
    this.assertCanView(user, organization);
  }
}
