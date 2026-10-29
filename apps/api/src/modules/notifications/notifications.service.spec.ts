import { NotificationsService } from './notifications.service';

/**
 * O raio decide quem é avisado de uma doação. Um erro aqui é silencioso: ou a
 * ONG vizinha nunca fica sabendo, ou todo mundo recebe alerta de tudo.
 */
describe('NotificationsService - raio de proximidade', () => {
  // Limeira/SP como referência do doador; ~11km e ~90km de distância.
  const donorAddress = { latitude: -22.5, longitude: -47.4 };
  const perto = { latitude: -22.6, longitude: -47.4 };
  const longe = { latitude: -23.3, longitude: -47.4 };

  function buildService(
    ngos: {
      id: string;
      notificationRadiusKm: number | null;
      address: object;
      notificationCategories?: string[];
    }[],
  ) {
    const created: { userId: string }[] = [];
    const prisma = {
      address: { findUniqueOrThrow: jest.fn().mockResolvedValue(donorAddress) },
      organization: {
        findMany: jest.fn().mockResolvedValue(
          ngos.map((n) => ({
            ...n,
            notificationCategories: n.notificationCategories ?? [],
            users: [
              {
                userId: `user-${n.id}`,
                user: { email: `${n.id}@t.com`, emailVerifiedAt: new Date() },
              },
            ],
          })),
        ),
      },
      notification: {
        createMany: jest.fn(({ data }: { data: { userId: string }[] }) => {
          created.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
    };
    const config = {
      get: jest.fn((key: string) => (key === 'notifications.radiusKm' ? 50 : 'http://web.test')),
    };
    const gateway = { emitToUser: jest.fn() };
    const mail = { send: jest.fn().mockResolvedValue(true) };
    const service = new NotificationsService(
      prisma as never,
      config as never,
      gateway as never,
      mail as never,
    );
    return { service, created, gateway, mail };
  }

  const donationList = {
    id: 'list-1',
    items: [{ category: 'NATURAL_FOODS', foodName: 'Banana' }],
  } as never;

  it('avisa a ONG dentro do raio padrão', async () => {
    const { service, created, gateway } = buildService([
      { id: 'perto', notificationRadiusKm: null, address: perto },
    ]);
    await service.notifyNearbyNgos(donationList, 'addr-1');
    expect(created.map((c) => c.userId)).toEqual(['user-perto']);
    expect(gateway.emitToUser).toHaveBeenCalledWith('user-perto', 'notification:new', expect.anything());
  });

  it('não avisa a ONG fora do raio padrão', async () => {
    const { service, created } = buildService([{ id: 'longe', notificationRadiusKm: null, address: longe }]);
    await service.notifyNearbyNgos(donationList, 'addr-1');
    expect(created).toHaveLength(0);
  });

  it('respeita o raio que a própria ONG configurou, acima do padrão', async () => {
    const { service, created } = buildService([{ id: 'longe', notificationRadiusKm: 200, address: longe }]);
    await service.notifyNearbyNgos(donationList, 'addr-1');
    expect(created.map((c) => c.userId)).toEqual(['user-longe']);
  });

  it('respeita o raio que a própria ONG configurou, abaixo do padrão', async () => {
    const { service, created } = buildService([{ id: 'perto', notificationRadiusKm: 5, address: perto }]);
    await service.notifyNearbyNgos(donationList, 'addr-1');
    expect(created).toHaveLength(0);
  });

  it('não grava nem emite nada quando ninguém está no raio', async () => {
    const { service, gateway } = buildService([{ id: 'longe', notificationRadiusKm: null, address: longe }]);
    await service.notifyNearbyNgos(donationList, 'addr-1');
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('respeita as categorias de interesse da ONG', async () => {
    const { service, created } = buildService([
      {
        id: 'so-preparados',
        notificationRadiusKm: null,
        address: perto,
        notificationCategories: ['PREPARED_MEALS'],
      },
    ]);
    await service.notifyNearbyNgos(donationList, 'addr-1'); // doação é NATURAL_FOODS
    expect(created).toHaveLength(0);
  });

  it('sem categorias declaradas, a ONG recebe alerta de qualquer alimento', async () => {
    const { service, created } = buildService([
      {
        id: 'tudo',
        notificationRadiusKm: null,
        address: perto,
        notificationCategories: [],
      },
    ]);
    await service.notifyNearbyNgos(donationList, 'addr-1');
    expect(created).toHaveLength(1);
  });

  it('envia e-mail para quem já confirmou o endereço', async () => {
    const { service, mail } = buildService([{ id: 'perto', notificationRadiusKm: null, address: perto }]);
    await service.notifyNearbyNgos(donationList, 'addr-1');
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'perto@t.com',
        text: expect.stringContaining('/doacoes/list-1'),
      }),
    );
  });
});

describe('NotificationsService - reserva recebida pelo doador', () => {
  it('avisa cada usuário do doador pelo sino, em tempo real e por e-mail confirmado', async () => {
    const prisma = {
      organizationUser: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'donor-1', user: { email: 'a@t.com', emailVerifiedAt: new Date() } },
          { userId: 'donor-2', user: { email: 'b@t.com', emailVerifiedAt: null } },
        ]),
      },
      notification: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const gateway = { emitToUser: jest.fn() };
    const mail = { send: jest.fn().mockResolvedValue(true) };
    const service = new NotificationsService(
      prisma as never,
      { get: jest.fn().mockReturnValue('http://web.test') } as never,
      gateway as never,
      mail as never,
    );

    await service.notifyDonorOfReservation({
      donationListId: 'list-1',
      donorOrganizationId: 'org-1',
      ngoName: 'ONG Esperança',
      itemsSummary: 'Arroz (5 kg)',
    });

    expect(prisma.organizationUser.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' } }),
    );
    const message = expect.stringContaining('ONG Esperança') as unknown;
    expect(prisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'donor-1',
          type: 'DONATION_RESERVED',
          donationListId: 'list-1',
          message,
        }),
        expect.objectContaining({
          userId: 'donor-2',
          type: 'DONATION_RESERVED',
          donationListId: 'list-1',
          message,
        }),
      ],
    });
    expect(gateway.emitToUser).toHaveBeenCalledTimes(2);
    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@t.com' }));
  });
});
