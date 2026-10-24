import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApprovalStatus, DonationListStatus, OrganizationKind, Prisma } from '@prisma/client';
import { DonationsService } from './donations.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

describe('DonationsService', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'a@a.com',
    role: 'DONOR',
    nodeId: 'LIMEIRA',
  };
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
      organizationUser: {
        findFirst: jest.fn().mockResolvedValue(approvedOrgLink),
      },
      donationList: {
        create: jest.fn().mockResolvedValue({ id: 'donation-list-1' }),
      },
      ...prismaOverrides,
    };
    const auditLogService = { record: jest.fn() };
    const syncService = { publishEvent: jest.fn() };
    const notificationsService = {
      notifyNearbyNgos: jest.fn().mockResolvedValue(undefined),
      removeForDonationList: jest.fn().mockResolvedValue(undefined),
      notifyReservationsCancelledByDonor: jest.fn().mockResolvedValue(undefined),
    };
    const service = new DonationsService(
      prisma as never,
      auditLogService as never,
      syncService as never,
      notificationsService as never,
    );
    return {
      service,
      prisma,
      auditLogService,
      syncService,
      notificationsService,
    };
  }

  const baseDto = {
    allowPartial: true,
    items: [
      {
        foodName: 'Arroz',
        category: 'PACKAGED_GOODS' as const,
        quantity: 10,
        unit: 'kg',
      },
    ],
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

  describe('cancelamento pelo doador', () => {
    /** Lista com um item inteiro reservado — o caso que antes não podia cancelar. */
    function buildCancellable(status: DonationListStatus) {
      const donationList = {
        id: 'donation-list-1',
        status,
        donorOrganizationId: 'org-1',
        items: [
          {
            id: 'item-1',
            foodName: 'Arroz',
            quantity: new Prisma.Decimal(10),
            remainingQuantity: new Prisma.Decimal(0),
          },
        ],
      };

      const tx = {
        reservation: {
          findMany: jest.fn().mockResolvedValue([{ id: 'res-1', ngoOrganizationId: 'ngo-1' }]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        donationItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        donationList: {
          update: jest.fn().mockResolvedValue({
            ...donationList,
            status: DonationListStatus.CANCELLED,
          }),
        },
      };

      return buildService({
        donationList: { findFirst: jest.fn().mockResolvedValue(donationList) },
        organizationUser: {
          findFirst: jest.fn().mockResolvedValue({ id: 'link-1' }),
        },
        $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
        __tx: tx,
      });
    }

    it('cancela a lista mesmo com tudo reservado, desfazendo as reservas ativas', async () => {
      const { service, prisma, notificationsService } = buildCancellable(DonationListStatus.FULLY_RESERVED);
      const tx = (prisma as unknown as { __tx: Record<string, never> }).__tx as never as {
        reservation: { updateMany: jest.Mock };
        donationItem: { updateMany: jest.Mock };
      };

      const updated = await service.cancel(user, 'donation-list-1');

      expect(updated.status).toBe(DonationListStatus.CANCELLED);
      expect(tx.reservation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
      expect(tx.donationItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CANCELLED' } }),
      );
      expect(notificationsService.notifyReservationsCancelledByDonor).toHaveBeenCalledWith(
        'donation-list-1',
        ['ngo-1'],
        'Arroz',
      );
    });

    it('recusa cancelar uma lista já encerrada', async () => {
      const { service } = buildCancellable(DonationListStatus.CLOSED);
      await expect(service.cancel(user, 'donation-list-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('detalhe da doação para a ONG', () => {
    const ngoUser: AuthenticatedUser = { ...user, id: 'ngo-user-1', role: 'NGO' };
    const reservedList = {
      id: 'donation-list-1',
      donorOrganizationId: 'org-1',
      status: DonationListStatus.FULLY_RESERVED,
      donorOrganization: { approvalStatus: ApprovalStatus.APPROVED },
    };

    function buildDetailService(reservation: { id: string } | null) {
      return buildService({
        organizationUser: { findFirst: jest.fn().mockResolvedValue(null) },
        donationList: { findFirst: jest.fn().mockResolvedValue(reservedList) },
        reservation: { findFirst: jest.fn().mockResolvedValue(reservation) },
      });
    }

    it('continua mostrando a doação já reservada para a ONG que reservou', async () => {
      const { service, prisma } = buildDetailService({ id: 'reservation-1' });

      await expect(service.findOne(ngoUser, 'donation-list-1')).resolves.toBe(reservedList);
      expect(
        (prisma as unknown as { reservation: { findFirst: jest.Mock } }).reservation.findFirst,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ donationListId: 'donation-list-1' }),
        }),
      );
    });

    it('recusa a doação reservada para uma ONG que não tem reserva nela', async () => {
      const { service } = buildDetailService(null);

      await expect(service.findOne(ngoUser, 'donation-list-1')).rejects.toThrow(ForbiddenException);
    });
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
