import { PrismaClient, OrganizationKind, ApprovalStatus, UserRole, DonationCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ReservationsService } from './reservations.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

/**
 * Teste de integração contra o Postgres real (não mockado) que prova a exigência
 * da seção 13/37 da especificação: duas ONGs tentando reservar a MESMA doação ao
 * mesmo tempo -> exatamente uma reserva vence, a outra recebe um conflito claro.
 *
 * Requer DATABASE_URL apontando para um Postgres acessível (o mesmo usado em
 * desenvolvimento). Roda com `npm test` dentro de apps/api.
 */
describe('ReservationsService - concorrência de reserva', () => {
  const prisma = new PrismaClient();
  const noopAuditLog = { record: jest.fn().mockResolvedValue(undefined) };
  const noopSync = { publishEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new ReservationsService(prisma as never, noopAuditLog as never, noopSync as never);
  const runId = Date.now();

  let ngoAId: string;
  let ngoBId: string;
  let donationId: string;
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdAddressIds: string[] = [];

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

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('senha1234', 4);
    const donorUser = await prisma.user.create({
      data: {
        email: `donor-${runId}@teste.com`,
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
        legalName: 'Restaurante Concorrência LTDA',
        tradeName: 'Restaurante Concorrência',
        phone: '19999999999',
        email: `donor-org-${runId}@teste.com`,
        responsibleName: 'Responsável Teste',
        approvalStatus: ApprovalStatus.APPROVED,
        nodeId: 'LIMEIRA',
        addressId: donorAddress.id,
      },
    });
    createdOrgIds.push(donorOrg.id);

    const donation = await prisma.donation.create({
      data: {
        donorOrganizationId: donorOrg.id,
        nodeId: 'LIMEIRA',
        foodName: 'Marmitas prontas',
        category: DonationCategory.PREPARED_MEALS,
        quantity: 20,
        unit: 'un',
        availableAt: new Date(),
        pickupDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
    });
    donationId = donation.id;

    const ngoA = await createNgoUser('A');
    const ngoB = await createNgoUser('B');
    ngoAId = ngoA.userId;
    ngoBId = ngoB.userId;
  }, 30_000);

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { donationId } });
    await prisma.donation.deleteMany({ where: { id: donationId } });
    await prisma.organizationUser.deleteMany({ where: { userId: { in: createdUserIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.address.deleteMany({ where: { id: { in: createdAddressIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('permite que apenas uma de duas reservas simultâneas para a mesma doação vença', async () => {
    const userA: AuthenticatedUser = { id: ngoAId, email: 'a', role: 'NGO', nodeId: 'LIMEIRA' };
    const userB: AuthenticatedUser = { id: ngoBId, email: 'b', role: 'NGO', nodeId: 'LIMEIRA' };

    const results = await Promise.allSettled([
      service.reserve(userA, donationId),
      service.reserve(userB, donationId),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const donation = await prisma.donation.findUniqueOrThrow({ where: { id: donationId } });
    expect(donation.status).toBe('RESERVED');

    const reservations = await prisma.reservation.findMany({ where: { donationId } });
    expect(reservations).toHaveLength(1);
  }, 30_000);

  it('rejeita reservar novamente a mesma doação já reservada, com o motivo correto', async () => {
    // A doação já está RESERVED após o teste anterior; não importa qual ONG venceu,
    // uma nova tentativa (mesmo pela ONG vencedora) deve ser rejeitada.
    const userA: AuthenticatedUser = { id: ngoAId, email: 'a', role: 'NGO', nodeId: 'LIMEIRA' };
    await expect(service.reserve(userA, donationId)).rejects.toMatchObject({
      response: { code: 'DONATION_ALREADY_RESERVED' },
    });
  });
});
