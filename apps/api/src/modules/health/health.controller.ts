import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import Redis from 'ioredis';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('health')
@Public()
@Controller()
export class HealthController {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.redis = new Redis(this.config.get<string>('redisUrl')!, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  @Get('health')
  @ApiOperation({ summary: 'Liveness: o processo está de pé.' })
  health() {
    return {
      status: 'ok',
      nodeId: this.config.get('node.id'),
      timestamp: new Date().toISOString(),
    };
  }

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
      await this.redis.connect();
      await this.redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    } finally {
      this.redis.disconnect();
    }

    const ok = checks.database && checks.redis;
    return {
      status: ok ? 'ok' : 'degraded',
      nodeId: this.config.get('node.id'),
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
