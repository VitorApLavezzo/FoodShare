import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, OrganizationKind } from '@prisma/client';
import { DonationsService } from './donations.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('DonationsService', () => {
  const user: AuthenticatedUser = { id: 'user-1', email: 'a@a.com', role: 'DONOR', nodeId: 'LIMEIRA' };
  const approvedOrgLink = {
    organization: {
      id: 'org-1',
      addressId: 'address-1',
      kind: OrganizationKind.DONOR,
      approvalStatus: ApprovalStatus.APPROVED,
    },
  };

  function buildService(prismaOverrides: Record<string, unknown> = {}) {
    const prisma = {
      organizationUser: { findFirst: jest.fn().mockResolvedValue(approvedOrgLink) },
      donationList: { create: jest.fn().mockResolvedValue({ id: 'donation-list-1' }) },
      ...prismaOverrides,
    };
    const auditLogService = { record: jest.fn() };
    const syncService = { publishEvent: jest.fn() };
    const notificationsService = { notifyNearbyNgos: jest.fn().mockResolvedValue(undefined) };
    const service = new DonationsService(
      prisma as never,
      auditLogService as never,
      syncService as never,
      notificationsService as never,
    );
    return { service, prisma, auditLogService, syncService, notificationsService };
  }

  const baseDto = {
    allowPartial: true,
    items: [{ foodName: 'Arroz', category: 'PACKAGED_GOODS' as const, quantity: 10, unit: 'kg' }],
  };

  it('rejeita quando o prazo de retirada é anterior à disponibilidade', async () => {
    const { service } = buildService();
    await expect(
      service.create(user, {
        ...baseDto,
        availableAt: '2026-08-15T14:00:00Z',
        pickupDeadline: '2026-08-14T14:00:00Z',
        expiresAt: '2026-08-20T14:00:00Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita quando o prazo de retirada é depois da validade', async () => {
    const { service } = buildService();
    await expect(
      service.create(user, {
        ...baseDto,
        availableAt: '2026-08-15T14:00:00Z',
        pickupDeadline: '2026-08-25T14:00:00Z',
        expiresAt: '2026-08-20T14:00:00Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita quando a validade já está no passado', async () => {
    const { service } = buildService();
    await expect(
      service.create(user, {
        ...baseDto,
        availableAt: '2020-01-01T14:00:00Z',
        pickupDeadline: '2020-01-02T14:00:00Z',
        expiresAt: '2020-01-03T14:00:00Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('cria a lista de doação e registra auditoria + evento de sincronização + notificação quando os dados são válidos', async () => {
    const { service, prisma, auditLogService, syncService, notificationsService } = buildService();
    const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 15 * 86_400_000).toISOString();

    await service.create(user, {
      ...baseDto,
      availableAt: new Date().toISOString(),
      pickupDeadline: future,
      expiresAt: later,
    });

    expect(prisma.donationList.create).toHaveBeenCalledTimes(1);
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'DONATION_LIST_CREATED' }),
    );
    expect(syncService.publishEvent).toHaveBeenCalledWith(
      'DONATION_LIST_CREATED',
      'donation-list-1',
      expect.anything(),
    );
    expect(notificationsService.notifyNearbyNgos).toHaveBeenCalledWith(expect.anything(), 'address-1');
  });

  it('rejeita a criação quando o doador não tem organização cadastrada', async () => {
    const { service } = buildService({
      organizationUser: { findFirst: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      service.create(user, {
        ...baseDto,
        availableAt: new Date().toISOString(),
        pickupDeadline: new Date(Date.now() + 86_400_000).toISOString(),
        expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejeita a criação quando a organização ainda não foi aprovada', async () => {
    const { service } = buildService({
      organizationUser: {
        findFirst: jest.fn().mockResolvedValue({
          organization: {
            id: 'org-1',
            addressId: 'address-1',
            kind: OrganizationKind.DONOR,
            approvalStatus: ApprovalStatus.PENDING,
          },
        }),
      },
    });

    await expect(
      service.create(user, {
        ...baseDto,
        availableAt: new Date().toISOString(),
        pickupDeadline: new Date(Date.now() + 86_400_000).toISOString(),
        expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
