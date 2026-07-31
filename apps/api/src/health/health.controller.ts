import { Controller, Get, Inject } from '@nestjs/common';
import type IORedis from 'ioredis';
import { REDIS_CONNECTION } from '../queues/redis-connection.token';

const PING_TIMEOUT_MS = 2_000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_CAP_MS = 300_000;

interface RedisHealth {
  ok: boolean;
  error?: string;
  stale?: boolean;
}

/** Pings the real, shared Redis connection (the same one BullMQ uses) rather than only checking
 * `.status`, which stays `'ready'` even while every command is being rejected — e.g. Upstash's
 * monthly command quota being exhausted. This is the only way an admin has of noticing "batches
 * aren't progressing" is a real Redis problem rather than something silent.
 *
 * A real ping on every single call is fine when the only caller is apps/web's Batches page
 * (60s polling), but once this is behind a real platform health check (Fly's own, hitting this
 * far more often than that) a sustained outage would burn real command quota for no benefit —
 * pinging faster doesn't make Upstash's monthly quota reset any sooner. Once a ping fails, this
 * opens a capped-exponential-backoff circuit (30s → 60s → 120s → 240s → capped at 5min) and
 * returns the cached result marked `stale: true` instead of re-pinging, until the backoff window
 * elapses — same "never silently pass off a non-live result as a fresh one" principle this
 * codebase already applies to `Send.simulated` and enrichment's `not_found` status. */
@Controller('health')
export class HealthController {
  private circuitOpenUntil = 0;
  private consecutiveFailures = 0;
  private lastResult: RedisHealth = { ok: true };

  constructor(@Inject(REDIS_CONNECTION) private readonly redis: IORedis) {}

  @Get()
  async check() {
    const redis = await this.checkRedis();
    return { status: redis.ok ? 'ok' : 'degraded', redis };
  }

  private async checkRedis(): Promise<RedisHealth> {
    if (Date.now() < this.circuitOpenUntil) {
      return { ...this.lastResult, stale: true };
    }

    try {
      await Promise.race([
        this.redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Redis ping timed out after ${PING_TIMEOUT_MS}ms`)), PING_TIMEOUT_MS)),
      ]);
      this.consecutiveFailures = 0;
      this.circuitOpenUntil = 0;
      this.lastResult = { ok: true };
      return this.lastResult;
    } catch (err) {
      this.consecutiveFailures += 1;
      this.circuitOpenUntil = Date.now() + Math.min(BACKOFF_BASE_MS * 2 ** (this.consecutiveFailures - 1), BACKOFF_CAP_MS);
      this.lastResult = { ok: false, error: err instanceof Error ? err.message : 'Unknown Redis error' };
      return this.lastResult;
    }
  }
}
