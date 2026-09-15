import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { AuditLogService } from '../audit/audit-log.service';
import { QueryUsersDto, UpdateUserStatusDto } from './dto/admin-users.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findMany(query: QueryUsersDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          deactivatedReason: true,
          emailVerifiedAt: true,
          createdAt: true,
          organizationLinks: { select: { organization: { select: { tradeName: true, kind: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async updateStatus(admin: AuthenticatedUser, id: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.deletedAt) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuário não encontrado.' });
    }
    // Um admin se auto-bloquear deixaria a plataforma sem quem administrar.
    if (user.id === admin.id) {
      throw new BadRequestException({
        code: 'CANNOT_BLOCK_SELF',
        message: 'Você não pode bloquear a própria conta.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: {
          isActive: dto.isActive,
          deactivatedReason: dto.isActive ? null : (dto.reason ?? 'Conta bloqueada pela administração.'),
        },
      });

      // Bloquear sem revogar as sessões abertas não tiraria ninguém do ar até
      // o access token vencer.
      if (!dto.isActive) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return result;
    });

    await this.auditLogService.record({
      entity: 'User',
      entityId: id,
      eventType: dto.isActive ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
      userId: admin.id,
      nodeId: admin.nodeId,
      previousData: { isActive: user.isActive },
      newData: { isActive: updated.isActive, reason: updated.deactivatedReason },
    });

    const { passwordHash, ...safe } = updated;
    return safe;
  }
}
