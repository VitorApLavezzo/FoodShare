import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { LeaderLockService } from '../common/leader-lock.service';
import { REDIS_CLIENT } from './redis.constants';

export { REDIS_CLIENT };

// Cliente Redis simples (comandos GET/SET/pub-sub), separado do uso de Redis
// Streams do SyncService — mesma instância Redis, propósitos distintos.
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => new Redis(config.get<string>('redisUrl')!),
      inject: [ConfigService],
    },
    LeaderLockService,
  ],
  exports: [REDIS_CLIENT, LeaderLockService],
})
export class RedisModule {}
