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

  function buildService(ngos: { id: string; notificationRadiusKm: number | null; address: object }[]) {
    const created: { userId: string }[] = [];
    const prisma = {
      address: { findUniqueOrThrow: jest.fn().mockResolvedValue(donorAddress) },
      organization: {
        findMany: jest.fn().mockResolvedValue(
          ngos.map((n) => ({ ...n, users: [{ userId: `user-${n.id}` }] })),
        ),
      },
      notification: {
        createMany: jest.fn(({ data }: { data: { userId: string }[] }) => {
          created.push(...data);
          return Promise.resolve({ count: data.length });
        }),
      },
    };
    const config = { get: jest.fn().mockReturnValue(50) };
    const gateway = { emitToUser: jest.fn() };
    const service = new NotificationsService(prisma as never, config as never, gateway as never);
    return { service, created, gateway };
  }

  const donationList = { id: 'list-1' } as never;

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
});
