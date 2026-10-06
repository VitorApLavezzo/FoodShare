import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, ServerOptions } from 'socket.io';

// Faz o Socket.IO fanoutar eventos entre as instâncias da API via Redis
// pub/sub (mesmo Redis do SyncService, canais próprios do adapter) — necessário
// porque os 3 nós simulados do docker-compose têm processos Node separados.
export class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly redisUrl: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    // `IoAdapter.createIOServer` é declarado como `any`: sem este tipo, tudo que
    // encosta no servidor daqui para baixo deixa de ser verificado.
    const server = super.createIOServer(port, options) as Server;
    const pubClient = new Redis(this.redisUrl);
    const subClient = pubClient.duplicate();
    server.adapter(createAdapter(pubClient, subClient));
    return server;
  }
}
