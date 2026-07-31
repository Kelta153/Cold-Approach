import { Controller, Get, Inject } from '@nestjs/common';
import type IORedis from 'ioredis';
import { REDIS_CONNECTION } from '../queues/redis-connection.token';

const PING_TIMEOUT_MS = 2_000;

interface RedisHealth {
  ok: boolean;
  error?: string;
}

/** Pings the real, shared Redis connection (the same one BullMQ uses) rather than only checking
 * `.status`, which stays `'ready'` even while every command is being rejected — e.g. Upstash's
 * monthly command quota being exhausted. This is the only way an admin has of noticing "batches
 * aren't progressing" is a real Redis problem rather than something silent. This is a genuine,
 * deliberate extra Redis command on every call — keep the poll interval on the frontend
 * reasonable (see apps/web's Batches page) rather than polling this aggressively. */
@Controller('health')
export class HealthController {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: IORedis) {}

  @Get()
  async check() {
    const redis = await this.checkRedis();
    return { status: redis.ok ? 'ok' : 'degraded', redis };
  }

  private async checkRedis(): Promise<RedisHealth> {
    try {
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Redis ping timed out after ${PING_TIMEOUT_MS}ms`)), PING_TIMEOUT_MS)),
      ]);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown Redis error' };
    }
  }
}
