import { PrismaClient, OrganizationKind, ApprovalStatus, UserRole, DonationCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ReservationsService } from './reservations.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Teste de integração contra o Postgres real (não mockado) que prova a exigência
 * de concorrência: duas ONGs tentando reservar quantidades do MESMO item ao
 * mesmo tempo nunca conseguem, juntas, levar mais do que existe.
 *
 * Requer DATABASE_URL apontando para um Postgres acessível (o mesmo usado em
 * desenvolvimento). Roda com `npm test` dentro de apps/api.
 */
describe('ReservationsService - concorrência de reserva por item', () => {
  const prisma = new PrismaClient();
  const noopAuditLog = { record: jest.fn().mockResolvedValue(undefined) };
  const noopSync = { publishEvent: jest.fn().mockResolvedValue(undefined) };
  const noopChat = { getOrCreateConversation: jest.fn().mockResolvedValue({ id: 'conv-noop' }) };
  const service = new ReservationsService(prisma as never, noopAuditLog as never, noopSync as never, noopChat as never);
  const runId = Date.now();

  let ngoAId: string;
  let ngoBId: string;
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdAddressIds: string[] = [];
  const createdListIds: string[] = [];

  async function createNgoUser(label: string): Promise<{ userId: string; org: AuthenticatedUser }> {
    const passwordHash = await bcrypt.hash('senha1234', 4);
    const user = await prisma.user.create({
      data: {
        email: `ngo-${label}-${runId}@teste.com`,
        name: `ONG ${label}`,
        role: UserRole.NGO,
        passwordHash,
        nodeId: 'LIMEIRA',
      },
    });
    createdUserIds.push(user.id);

    const address = await prisma.address.create({
      data: {
        street: 'Rua Teste',
        neighborhood: 'Centro',
        city: 'Limeira',
        state: 'SP',
        zipCode: '13480000',
        latitude: -22.5,
        longitude: -47.4,
      },
    });
    createdAddressIds.push(address.id);

    const organization = await prisma.organization.create({
      data: {
        kind: OrganizationKind.NGO,
        legalName: `ONG ${label} LTDA`,
        tradeName: `ONG ${label}`,
        phone: '19999999999',
        email: `contato-${label}-${runId}@teste.com`,
        responsibleName: 'Responsável Teste',
        approvalStatus: ApprovalStatus.APPROVED,
        nodeId: 'LIMEIRA',
        addressId: address.id,
      },
    });
    createdOrgIds.push(organization.id);

    await prisma.organizationUser.create({
      data: { organizationId: organization.id, userId: user.id },
    });

    return {
      userId: user.id,
      org: { id: user.id, email: user.email, role: 'NGO', nodeId: 'LIMEIRA' },
    };
  }

  async function createDonationList(quantity: number, allowPartial: boolean) {
    const passwordHash = await bcrypt.hash('senha1234', 4);
    const donorUser = await prisma.user.create({
      data: {
        email: `donor-${runId}-${Math.random()}@teste.com`,
        name: 'Doador Teste',
        role: UserRole.DONOR,
        passwordHash,
        nodeId: 'LIMEIRA',
      },
    });
    createdUserIds.push(donorUser.id);

    const donorAddress = await prisma.address.create({
      data: {
        street: 'Rua Doador',
        neighborhood: 'Centro',
        city: 'Limeira',
        state: 'SP',
        zipCode: '13480000',
        latitude: -22.5,
        longitude: -47.4,
      },
    });
    createdAddressIds.push(donorAddress.id);

    const donorOrg = await prisma.organization.create({
      data: {
        kind: OrganizationKind.DONOR,
        legalName: `Restaurante Concorrência ${Math.random()} LTDA`,
        tradeName: 'Restaurante Concorrência',
        phone: '19999999999',
        email: `donor-org-${runId}-${Math.random()}@teste.com`,
        responsibleName: 'Responsável Teste',
        approvalStatus: ApprovalStatus.APPROVED,
        nodeId: 'LIMEIRA',
        addressId: donorAddress.id,
      },
    });
    createdOrgIds.push(donorOrg.id);

    const list = await prisma.donationList.create({
      data: {
        donorOrganizationId: donorOrg.id,
        nodeId: 'LIMEIRA',
        allowPartial,
        availableAt: new Date(),
        pickupDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
        items: {
          create: [
            {
              foodName: 'Marmitas prontas',
              category: DonationCategory.PREPARED_MEALS,
              quantity,
              remainingQuantity: quantity,
              unit: 'un',
            },
          ],
        },
      },
      include: { items: true },
    });
    createdListIds.push(list.id);
    return list;
  }

  beforeAll(async () => {
    const ngoA = await createNgoUser('A');
    const ngoB = await createNgoUser('B');
    ngoAId = ngoA.userId;
    ngoBId = ngoB.userId;
  }, 30_000);

  afterAll(async () => {
    await prisma.pickup.deleteMany({ where: { reservation: { donationListId: { in: createdListIds } } } });
    await prisma.reservationItem.deleteMany({ where: { reservation: { donationListId: { in: createdListIds } } } });
    await prisma.reservation.deleteMany({ where: { donationListId: { in: createdListIds } } });
    await prisma.donationItem.deleteMany({ where: { donationListId: { in: createdListIds } } });
    await prisma.donationList.deleteMany({ where: { id: { in: createdListIds } } });
    await prisma.organizationUser.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.address.deleteMany({ where: { id: { in: createdAddressIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('quando duas reservas concorrentes juntas excedem o disponível, só uma vence', async () => {
    const list = await createDonationList(10, true);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = { id: ngoAId, email: 'a', role: 'NGO', nodeId: 'LIMEIRA' };
    const userB: AuthenticatedUser = { id: ngoBId, email: 'b', role: 'NGO', nodeId: 'LIMEIRA' };

    const results = await Promise.allSettled([
      service.reserve(userA, { donationListId: list.id, items: [{ donationItemId: itemId, quantity: 7 }] }),
      service.reserve(userB, { donationListId: list.id, items: [{ donationItemId: itemId, quantity: 7 }] }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const item = await prisma.donationItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.remainingQuantity).toBe(3);
  }, 30_000);

  it('quando duas reservas concorrentes cabem no disponível, ambas vencem', async () => {
    const list = await createDonationList(10, true);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = { id: ngoAId, email: 'a', role: 'NGO', nodeId: 'LIMEIRA' };
    const userB: AuthenticatedUser = { id: ngoBId, email: 'b', role: 'NGO', nodeId: 'LIMEIRA' };

    const results = await Promise.allSettled([
      service.reserve(userA, { donationListId: list.id, items: [{ donationItemId: itemId, quantity: 6 }] }),
      service.reserve(userB, { donationListId: list.id, items: [{ donationItemId: itemId, quantity: 4 }] }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

    const item = await prisma.donationItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.remainingQuantity).toBe(0);
    expect(item.status).toBe('FULLY_RESERVED');
  }, 30_000);

  it('rejeita pedido parcial quando a lista não permite aceite parcial', async () => {
    const list = await createDonationList(10, false);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = { id: ngoAId, email: 'a', role: 'NGO', nodeId: 'LIMEIRA' };

    await expect(
      service.reserve(userA, { donationListId: list.id, items: [{ donationItemId: itemId, quantity: 4 }] }),
    ).rejects.toMatchObject({ response: { code: 'PARTIAL_NOT_ALLOWED' } });
  });
});
