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

@Injectable()
export class CnpjService {
  private readonly logger = new Logger(CnpjService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Nunca lança: qualquer falha (CNPJ inexistente, API fora do ar, timeout)
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

    try {
      const baseUrl = this.config.get<string>('cnpjApi.url');
      const { data } = await firstValueFrom(
        this.http.get<BrasilApiCnpjResponse>(`${baseUrl}/${cnpjDigits}`, { timeout: 5000 }),
      );

      const result: CnpjLookupResult = {
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

      const ttl = this.config.get<number>('cnpjApi.cacheTtlSeconds') ?? 86400;
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', ttl).catch(() => undefined);

      return result;
    } catch (err) {
      this.logger.warn(`Consulta de CNPJ falhou (${cnpjDigits}): ${(err as Error).message}`);
      return { found: false };
    }
  }
}
