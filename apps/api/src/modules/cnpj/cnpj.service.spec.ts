import { of, throwError } from 'rxjs';
import { CnpjService } from './cnpj.service';

/**
 * A regra mais importante aqui é negativa: a consulta de CNPJ nunca pode
 * derrubar o cadastro. Se a API externa cair, o usuário tem que continuar
 * conseguindo preencher tudo à mão.
 */
describe('CnpjService', () => {
  function buildService(httpGet: jest.Mock, cache: { get?: jest.Mock; set?: jest.Mock } = {}) {
    const http = { get: httpGet };
    const config = {
      get: jest.fn((key: string) => (key === 'cnpjApi.url' ? 'https://exemplo.test/cnpj' : 86400)),
    };
    const redis = {
      get: cache.get ?? jest.fn().mockResolvedValue(null),
      set: cache.set ?? jest.fn().mockResolvedValue('OK'),
    };
    return { service: new CnpjService(http as never, config as never, redis as never), redis };
  }

  const apiResponse = {
    data: {
      razao_social: 'Restaurante Exemplo LTDA',
      nome_fantasia: 'Restaurante Exemplo',
      municipio: 'Limeira',
      uf: 'SP',
    },
  };

  it('mapeia a resposta da API externa', async () => {
    const { service } = buildService(jest.fn().mockReturnValue(of(apiResponse)));
    const result = await service.lookup('11222333000181');
    expect(result).toMatchObject({
      found: true,
      legalName: 'Restaurante Exemplo LTDA',
      tradeName: 'Restaurante Exemplo',
      address: { city: 'Limeira', state: 'SP' },
    });
  });

  it('devolve found=false (sem lançar) quando a API falha', async () => {
    const { service } = buildService(jest.fn().mockReturnValue(throwError(() => new Error('timeout'))));
    await expect(service.lookup('11222333000181')).resolves.toEqual({ found: false });
  });

  it('usa o cache e não chama a API de novo', async () => {
    const cached = JSON.stringify({ found: true, legalName: 'Do cache' });
    const httpGet = jest.fn();
    const { service } = buildService(httpGet, { get: jest.fn().mockResolvedValue(cached) });

    const result = await service.lookup('11222333000181');
    expect(result).toEqual({ found: true, legalName: 'Do cache' });
    expect(httpGet).not.toHaveBeenCalled();
  });

  it('não quebra se o próprio cache estiver indisponível', async () => {
    const { service } = buildService(jest.fn().mockReturnValue(of(apiResponse)), {
      get: jest.fn().mockRejectedValue(new Error('redis fora')),
    });
    await expect(service.lookup('11222333000181')).resolves.toMatchObject({ found: true });
  });

  it('guarda o resultado no cache após consultar a API', async () => {
    const { service, redis } = buildService(jest.fn().mockReturnValue(of(apiResponse)));
    await service.lookup('11222333000181');
    expect(redis.set).toHaveBeenCalledWith(
      'foodshare:cnpj-cache:11222333000181',
      expect.stringContaining('Restaurante Exemplo'),
      'EX',
      86400,
    );
  });
});
