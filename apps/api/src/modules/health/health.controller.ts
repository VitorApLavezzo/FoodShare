import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { REDIS_CLIENT } from '../../redis/redis.constants';

@ApiTags('health')
@Public()
// Sondas de orquestrador batem com frequência: o limite global de 120/min faria
// o health check falhar por rate limit justamente sob carga.
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness: o processo está de pé.' })
  health() {
    return {
      status: 'ok',
      nodeId: this.config.get<string>('node.id'),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Responde 503 quando alguma dependência está fora — orquestrador olha o
   * status HTTP, não o corpo: com 200 fixo, um nó degradado continuava
   * recebendo tráfego normalmente.
   */
  @Get('ready')
  @ApiOperation({ summary: 'Readiness: dependências (DB, Redis) estão saudáveis.' })
  async ready() {
    const checks = { database: false, redis: false };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      await this.redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const body = {
      status: checks.database && checks.redis ? 'ok' : 'degraded',
      nodeId: this.config.get<string>('node.id'),
      checks,
      timestamp: new Date().toISOString(),
    };

    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
