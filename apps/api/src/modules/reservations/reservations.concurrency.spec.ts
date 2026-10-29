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
  const noopSync = {
    publishEvent: jest.fn().mockResolvedValue(undefined),
    broadcastChange: jest.fn(),
  };
  const noopChat = {
    createConversationForReservation: jest.fn(
      (
        tx: { conversation: { create: (args: unknown) => unknown } },
        reservationId: string,
        donationListId: string,
      ) => tx.conversation.create({ data: { reservationId, donationListId } }),
    ),
    notifyConversationCreated: jest.fn(),
  };
  const noopNotifications = { notifyDonorOfReservation: jest.fn() };
  const service = new ReservationsService(
    prisma as never,
    noopAuditLog as never,
    noopSync as never,
    noopChat as never,
    noopNotifications as never,
  );
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

  async function createDonationList(quantity: number, allowPartial: boolean, secondItemQuantity?: number) {
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

    const pickupDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const list = await prisma.donationList.create({
      data: {
        donorOrganizationId: donorOrg.id,
        nodeId: 'LIMEIRA',
        allowPartial,
        availableAt: new Date(),
        pickupDeadline,
        expiresAt,
        items: {
          create: [
            {
              foodName: 'Marmitas prontas',
              category: DonationCategory.PREPARED_MEALS,
              quantity,
              remainingQuantity: quantity,
              unit: 'un',
              pickupDeadline,
              expiresAt,
            },
            // Item extra opcional: mantém a lista OPEN depois que o primeiro
            // item esgota, que é a situação do teste de reserva fantasma.
            ...(secondItemQuantity !== undefined
              ? [
                  {
                    foodName: 'Pães',
                    category: DonationCategory.PACKAGED_GOODS,
                    quantity: secondItemQuantity,
                    remainingQuantity: secondItemQuantity,
                    unit: 'un',
                    pickupDeadline,
                    expiresAt,
                  },
                ]
              : []),
          ],
        },
      },
      include: { items: { orderBy: { foodName: 'asc' } } },
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
    await prisma.pickup.deleteMany({
      where: { reservation: { donationListId: { in: createdListIds } } },
    });
    await prisma.message.deleteMany({
      where: { conversation: { donationListId: { in: createdListIds } } },
    });
    await prisma.conversation.deleteMany({
      where: { donationListId: { in: createdListIds } },
    });
    await prisma.reservationItem.deleteMany({
      where: { reservation: { donationListId: { in: createdListIds } } },
    });
    await prisma.reservation.deleteMany({
      where: { donationListId: { in: createdListIds } },
    });
    await prisma.donationItem.deleteMany({
      where: { donationListId: { in: createdListIds } },
    });
    await prisma.donationList.deleteMany({
      where: { id: { in: createdListIds } },
    });
    await prisma.organizationUser.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: createdOrgIds } },
    });
    await prisma.address.deleteMany({
      where: { id: { in: createdAddressIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('quando duas reservas concorrentes juntas excedem o disponível, só uma vence', async () => {
    const list = await createDonationList(10, true);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = {
      id: ngoAId,
      email: 'a',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };
    const userB: AuthenticatedUser = {
      id: ngoBId,
      email: 'b',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };

    const results = await Promise.allSettled([
      service.reserve(userA, {
        donationListId: list.id,
        items: [{ donationItemId: itemId, quantity: 7 }],
      }),
      service.reserve(userB, {
        donationListId: list.id,
        items: [{ donationItemId: itemId, quantity: 7 }],
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const item = await prisma.donationItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.remainingQuantity.toNumber()).toBe(3);
  }, 30_000);

  it('quando duas reservas concorrentes cabem no disponível, ambas vencem', async () => {
    const list = await createDonationList(10, true);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = {
      id: ngoAId,
      email: 'a',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };
    const userB: AuthenticatedUser = {
      id: ngoBId,
      email: 'b',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };

    const results = await Promise.allSettled([
      service.reserve(userA, {
        donationListId: list.id,
        items: [{ donationItemId: itemId, quantity: 6 }],
      }),
      service.reserve(userB, {
        donationListId: list.id,
        items: [{ donationItemId: itemId, quantity: 4 }],
      }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);

    const item = await prisma.donationItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.remainingQuantity.toNumber()).toBe(0);
    expect(item.status).toBe('FULLY_RESERVED');
  }, 30_000);

  it('rejeita pedido parcial quando a lista não permite aceite parcial', async () => {
    const list = await createDonationList(10, false);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = {
      id: ngoAId,
      email: 'a',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };

    await expect(
      service.reserve(userA, {
        donationListId: list.id,
        items: [{ donationItemId: itemId, quantity: 4 }],
      }),
    ).rejects.toMatchObject({ response: { code: 'PARTIAL_NOT_ALLOWED' } });
  });

  // Regressão: item esgotado entrava no lock (o filtro era "!= CANCELLED"), a
  // quantidade virava 0 e nascia uma reserva fantasma de 0 unidade — com código
  // de retirada e conversa — que ainda impedia a lista de fechar.
  it('não cria reserva de quantidade zero sobre item já esgotado', async () => {
    const list = await createDonationList(1, true, 5);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = {
      id: ngoAId,
      email: 'a',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };
    const userB: AuthenticatedUser = {
      id: ngoBId,
      email: 'b',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };

    await service.reserve(userA, {
      donationListId: list.id,
      items: [{ donationItemId: itemId }],
    });

    await expect(
      service.reserve(userB, {
        donationListId: list.id,
        items: [{ donationItemId: itemId }],
      }),
    ).rejects.toMatchObject({ response: { code: 'ITEM_NOT_AVAILABLE' } });

    const reservations = await prisma.reservation.findMany({
      where: { donationListId: list.id },
      include: { items: true },
    });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].items.every((i) => i.quantity.toNumber() > 0)).toBe(true);
  }, 30_000);

  // Regressão: o cancelamento forçava a lista para OPEN sem olhar nada, então
  // cancelar uma reserva de uma lista já expirada a ressuscitava com validade
  // no passado.
  it('cancelar reserva de lista expirada não reabre a doação', async () => {
    const list = await createDonationList(10, true);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = {
      id: ngoAId,
      email: 'a',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };

    const reservation = await service.reserve(userA, {
      donationListId: list.id,
      items: [{ donationItemId: itemId, quantity: 4 }],
    });

    // Simula a lista tendo vencido enquanto a reserva estava ativa.
    await prisma.donationList.update({
      where: { id: list.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await service.cancel(userA, reservation.id);

    const [after, item] = await Promise.all([
      prisma.donationList.findUniqueOrThrow({ where: { id: list.id } }),
      prisma.donationItem.findUniqueOrThrow({ where: { id: itemId } }),
    ]);
    expect(after.status).not.toBe('OPEN');
    expect(item.status).toBe('EXPIRED');
  }, 30_000);

  // Regressão: com Float, somar/subtrair frações deixava resto binário e o item
  // "zerado" ficava com 1e-17 disponível, nunca saindo de AVAILABLE.
  it('reservas fracionadas zeram o item exatamente (sem resto de ponto flutuante)', async () => {
    const list = await createDonationList(1, true);
    const itemId = list.items[0].id;
    const userA: AuthenticatedUser = {
      id: ngoAId,
      email: 'a',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };
    const userB: AuthenticatedUser = {
      id: ngoBId,
      email: 'b',
      role: 'NGO',
      nodeId: 'LIMEIRA',
    };

    await service.reserve(userA, {
      donationListId: list.id,
      items: [{ donationItemId: itemId, quantity: 0.7 }],
    });
    await service.reserve(userB, {
      donationListId: list.id,
      items: [{ donationItemId: itemId, quantity: 0.3 }],
    });

    const item = await prisma.donationItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.remainingQuantity.toNumber()).toBe(0);
    expect(item.status).toBe('FULLY_RESERVED');
  }, 30_000);

  // Uma reserva ativa por ONG em cada doação: com reserva parcial, o formulário
  // seguia aberto depois da primeira e cada envio virava uma reserva nova da
  // mesma ONG sobre a mesma lista.
  it('recusa uma segunda reserva ativa da mesma ONG na mesma doação', async () => {
    const list = await createDonationList(10, true, 5);
    const userA: AuthenticatedUser = { id: ngoAId, email: 'a', role: 'NGO', nodeId: 'LIMEIRA' };

    await service.reserve(userA, {
      donationListId: list.id,
      items: [{ donationItemId: list.items[0].id, quantity: 2 }],
    });

    await expect(
      service.reserve(userA, {
        donationListId: list.id,
        items: [{ donationItemId: list.items[0].id, quantity: 2 }],
      }),
    ).rejects.toMatchObject({ response: { code: 'RESERVATION_ALREADY_EXISTS' } });

    const active = await prisma.reservation.count({
      where: { donationListId: list.id, status: 'ACTIVE' },
    });
    expect(active).toBe(1);
  }, 30_000);

  // Clique duplo em itens diferentes: o lock dos itens não serializa os dois
  // pedidos (cada um trava uma linha), então a regra precisa de trava própria.
  it('com dois pedidos simultâneos da mesma ONG em itens diferentes, só um vira reserva', async () => {
    const list = await createDonationList(10, true, 5);
    const userA: AuthenticatedUser = { id: ngoAId, email: 'a', role: 'NGO', nodeId: 'LIMEIRA' };

    const results = await Promise.allSettled([
      service.reserve(userA, {
        donationListId: list.id,
        items: [{ donationItemId: list.items[0].id }],
      }),
      service.reserve(userA, {
        donationListId: list.id,
        items: [{ donationItemId: list.items[1].id }],
      }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    const active = await prisma.reservation.count({
      where: { donationListId: list.id, status: 'ACTIVE' },
    });
    expect(active).toBe(1);
  }, 30_000);

  it('depois de cancelar, a mesma ONG pode reservar de novo', async () => {
    const list = await createDonationList(10, true);
    const userA: AuthenticatedUser = { id: ngoAId, email: 'a', role: 'NGO', nodeId: 'LIMEIRA' };

    const first = await service.reserve(userA, {
      donationListId: list.id,
      items: [{ donationItemId: list.items[0].id, quantity: 2 }],
    });
    await service.cancel(userA, first.id);

    await expect(
      service.reserve(userA, {
        donationListId: list.id,
        items: [{ donationItemId: list.items[0].id, quantity: 4 }],
      }),
    ).resolves.toMatchObject({ donationListId: list.id });
  }, 30_000);
});
