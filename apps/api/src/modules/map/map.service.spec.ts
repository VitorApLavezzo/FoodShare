import { MapService } from './map.service';

describe('MapService.findDonorReach', () => {
  // Limeira/SP; Piracicaba fica a ~30 km e Campinas a ~50 km.
  const limeira = { latitude: -22.5649, longitude: -47.4017, city: 'Limeira', state: 'SP' };
  const piracicaba = { latitude: -22.7253, longitude: -47.6492, city: 'Piracicaba', state: 'SP' };
  const saoPaulo = { latitude: -23.5505, longitude: -46.6333, city: 'São Paulo', state: 'SP' };

  function buildService(ngos: { notificationRadiusKm: number | null; address: typeof limeira }[]) {
    const prisma = {
      organizationUser: {
        findFirst: jest.fn().mockResolvedValue({ organization: { address: limeira } }),
      },
      organization: { findMany: jest.fn().mockResolvedValue(ngos) },
    };
    const config = { get: jest.fn().mockReturnValue(50) };
    return new MapService(prisma as never, config as never);
  }

  it('conta as ONGs dentro do raio de cada uma e agrupa por cidade, sem expor endereço', async () => {
    const service = buildService([
      { notificationRadiusKm: null, address: limeira },
      { notificationRadiusKm: null, address: limeira },
      { notificationRadiusKm: null, address: piracicaba },
      { notificationRadiusKm: null, address: saoPaulo },
    ]);

    const reach = await service.findDonorReach('donor-user');

    expect(reach).toEqual({
      defaultRadiusKm: 50,
      totalNgos: 3,
      byCity: [
        { city: 'Limeira', state: 'SP', count: 2 },
        { city: 'Piracicaba', state: 'SP', count: 1 },
      ],
    });
  });

  it('respeita o raio próprio da ONG no lugar do padrão', async () => {
    const service = buildService([
      { notificationRadiusKm: 10, address: piracicaba },
      { notificationRadiusKm: 200, address: saoPaulo },
    ]);

    const reach = await service.findDonorReach('donor-user');

    expect(reach.totalNgos).toBe(1);
    expect(reach.byCity).toEqual([{ city: 'São Paulo', state: 'SP', count: 1 }]);
  });
});
