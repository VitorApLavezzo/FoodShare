import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';

const DEFAULT_TTL_SECONDS = 50;

/**
 * Garante que uma tarefa agendada rode em apenas um nó por ciclo. Os 3 nós do
 * docker-compose executam os mesmos @Cron sobre o mesmo Postgres; sem isso, cada
 * execução duplicava auditoria, notificações e e-mails.
 *
 * Lock por `SET NX EX`: quem conseguir a chave executa, os demais desistem desse
 * ciclo. O TTL garante que um nó que morra no meio não trave a tarefa para sempre.
 */
@Injectable()
export class LeaderLockService {
  private readonly logger = new Logger(LeaderLockService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async runExclusively(
    jobName: string,
    task: () => Promise<void>,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<boolean> {
    const key = `foodshare:job-lock:${jobName}`;
    const acquired = await this.redis.set(key, process.pid.toString(), 'EX', ttlSeconds, 'NX');
    if (!acquired) return false;

    try {
      await task();
      return true;
    } catch (err) {
      this.logger.error(`Job ${jobName} falhou.`, err as Error);
      return false;
    } finally {
      await this.redis.del(key).catch(() => undefined);
    }
  }
}
