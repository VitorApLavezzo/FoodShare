import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, DonationRecurrence, OrganizationKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';
import { MIN_SHELF_LIFE_AFTER_PICKUP_MS } from '../donations/donation-dates';

const DEFAULT_PICKUP_WINDOW_HOURS = 24;
const DEFAULT_EXPIRES_IN_HOURS = 48;

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateTemplateDto) {
    const organization = await this.getApprovedDonorOrganization(user.id);
    const pickupWindowHours = dto.pickupWindowHours ?? DEFAULT_PICKUP_WINDOW_HOURS;
    const expiresInHours = dto.expiresInHours ?? DEFAULT_EXPIRES_IN_HOURS;
    this.assertValidWindows(pickupWindowHours, expiresInHours);

    return this.prisma.donationTemplate.create({
      data: {
        donorOrganizationId: organization.id,
        name: dto.name,
        allowPartial: dto.allowPartial,
        notes: dto.notes,
        items: dto.items as unknown as Prisma.InputJsonValue,
        recurrence: dto.recurrence,
        hourOfDay: dto.hourOfDay,
        weekday: dto.recurrence === DonationRecurrence.WEEKLY ? (dto.weekday ?? 1) : null,
        pickupWindowHours,
        expiresInHours,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findMany(user: AuthenticatedUser) {
    const organization = await this.getApprovedDonorOrganization(user.id);
    return this.prisma.donationTemplate.findMany({
      where: { donorOrganizationId: organization.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateTemplateDto) {
    const template = await this.getOwned(user, id);
    this.assertValidWindows(
      dto.pickupWindowHours ?? template.pickupWindowHours,
      dto.expiresInHours ?? template.expiresInHours,
    );

    return this.prisma.donationTemplate.update({
      where: { id: template.id },
      data: {
        name: dto.name,
        allowPartial: dto.allowPartial,
        notes: dto.notes,
        items: dto.items ? (dto.items as unknown as Prisma.InputJsonValue) : undefined,
        recurrence: dto.recurrence,
        hourOfDay: dto.hourOfDay,
        weekday: dto.weekday,
        pickupWindowHours: dto.pickupWindowHours,
        expiresInHours: dto.expiresInHours,
        isActive: dto.isActive,
      },
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const template = await this.getOwned(user, id);
    return this.prisma.donationTemplate.delete({ where: { id: template.id } });
  }

  /** A doação gerada tem de passar nas mesmas regras de data da doação manual. */
  private assertValidWindows(pickupWindowHours: number, expiresInHours: number) {
    if (expiresInHours * 3_600_000 < pickupWindowHours * 3_600_000 + MIN_SHELF_LIFE_AFTER_PICKUP_MS) {
      throw new BadRequestException({
        code: 'INVALID_EXPIRATION',
        message: 'A validade precisa ser de pelo menos 1 dia depois do prazo de retirada.',
      });
    }
  }

  private async getOwned(user: AuthenticatedUser, id: string) {
    const template = await this.prisma.donationTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException({ code: 'TEMPLATE_NOT_FOUND', message: 'Modelo não encontrado.' });
    }

    if (user.role !== 'ADMIN') {
      const link = await this.prisma.organizationUser.findFirst({
        where: { userId: user.id, organizationId: template.donorOrganizationId },
      });
      if (!link) {
        throw new ForbiddenException({
          code: 'FORBIDDEN_TEMPLATE_ACCESS',
          message: 'Você não tem acesso a este modelo.',
        });
      }
    }

    return template;
  }

  private async getApprovedDonorOrganization(userId: string) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId, organization: { kind: OrganizationKind.DONOR } },
      include: { organization: true },
    });

    if (!link) {
      throw new ForbiddenException({
        code: 'DONOR_ORGANIZATION_REQUIRED',
        message: 'Cadastre seu estabelecimento antes de criar modelos de doação.',
      });
    }
    if (link.organization.approvalStatus !== ApprovalStatus.APPROVED) {
      throw new ForbiddenException({
        code: 'DONOR_ORGANIZATION_NOT_APPROVED',
        message: 'Seu estabelecimento ainda não foi aprovado.',
      });
    }
    return link.organization;
  }
}
