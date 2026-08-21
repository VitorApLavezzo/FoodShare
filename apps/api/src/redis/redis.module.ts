import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

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
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
