import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants';

export interface CnpjLookupResult {
  found: boolean;
  legalName?: string;
  tradeName?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

/** Formato da BrasilAPI e da Minha Receita (a BrasilAPI usa a Minha Receita por trás). */
interface BrasilApiCnpjResponse {
  razao_social?: string;
  nome_fantasia?: string;
  ddd_telefone_1?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

interface ReceitaWsResponse {
  status?: string;
  message?: string;
  nome?: string;
  fantasia?: string;
  telefone?: string;
  email?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
}

interface CnpjProvider {
  name: string;
  url: (cnpj: string) => string;
  map: (data: unknown) => CnpjLookupResult;
}

const onlyDigits = (value?: string) => (value ? value.replace(/\D/g, '') : undefined);

function mapBrasilApi(raw: unknown): CnpjLookupResult {
  const data = raw as BrasilApiCnpjResponse;
  if (!data?.razao_social) throw new Error('resposta sem razao_social');
  return {
    found: true,
    legalName: data.razao_social,
    tradeName: data.nome_fantasia || data.razao_social,
    phone: data.ddd_telefone_1,
    email: data.email,
    address: {
      street: data.logradouro,
      number: data.numero,
      neighborhood: data.bairro,
      city: data.municipio,
      state: data.uf,
      zipCode: data.cep,
    },
  };
}

function mapReceitaWs(raw: unknown): CnpjLookupResult {
  const data = raw as ReceitaWsResponse;
  if (data?.status === 'ERROR' || !data?.nome) throw new Error(data?.message ?? 'resposta sem nome');
  return {
    found: true,
    legalName: data.nome,
    tradeName: data.fantasia || data.nome,
    phone: data.telefone?.split('/')[0]?.trim(),
    email: data.email?.toLowerCase(),
    address: {
      street: data.logradouro,
      number: data.numero,
      neighborhood: data.bairro,
      city: data.municipio,
      state: data.uf,
      zipCode: onlyDigits(data.cep),
    },
  };
}

@Injectable()
export class CnpjService {
  private readonly logger = new Logger(CnpjService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Provedores consultados em ordem: se um falhar (timeout, 5xx, limite de
   * requisições), tenta o próximo. A BrasilAPI oscila bastante na rota de CNPJ.
   */
  private providers(): CnpjProvider[] {
    const brasilApiUrl = this.config.get<string>('cnpjApi.url');
    return [
      { name: 'BrasilAPI', url: (c) => `${brasilApiUrl}/${c}`, map: mapBrasilApi },
      { name: 'MinhaReceita', url: (c) => `https://minhareceita.org/${c}`, map: mapBrasilApi },
      { name: 'ReceitaWS', url: (c) => `https://receitaws.com.br/v1/cnpj/${c}`, map: mapReceitaWs },
    ];
  }

  /**
   * Nunca lança: qualquer falha (CNPJ inexistente, APIs fora do ar, timeout)
   * vira `{ found: false }` para nunca bloquear o cadastro manual.
   */
  async lookup(cnpjDigits: string): Promise<CnpjLookupResult> {
    const cacheKey = `foodshare:cnpj-cache:${cnpjDigits}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as CnpjLookupResult;
    } catch (err) {
      this.logger.warn(`Falha ao ler cache de CNPJ: ${(err as Error).message}`);
    }

    const timeout = this.config.get<number>('cnpjApi.timeoutMs') ?? 8000;

    for (const provider of this.providers()) {
      try {
        const { data } = await firstValueFrom(
          this.http.get<unknown>(provider.url(cnpjDigits), {
            timeout,
            headers: { Accept: 'application/json', 'User-Agent': 'FoodShare/1.0' },
          }),
        );
        const result = provider.map(data);

        const ttl = this.config.get<number>('cnpjApi.cacheTtlSeconds') ?? 86400;
        await this.redis.set(cacheKey, JSON.stringify(result), 'EX', ttl).catch(() => undefined);

        return result;
      } catch (err) {
        this.logger.warn(`Consulta de CNPJ falhou em ${provider.name} (${cnpjDigits}): ${(err as Error).message}`);
      }
    }

    return { found: false };
  }
}
