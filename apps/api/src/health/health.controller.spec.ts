import type IORedis from 'ioredis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';

function fakeRedis(ping: () => Promise<unknown>): IORedis {
  return { ping } as unknown as IORedis;
}

describe('HealthController.check', () => {
  it('reports ok when the real Redis ping succeeds', async () => {
    const controller = new HealthController(fakeRedis(() => Promise.resolve('PONG')));

    await expect(controller.check()).resolves.toEqual({ status: 'ok', redis: { ok: true } });
  });

  it('reports degraded with the real error message when Redis rejects a command — e.g. quota exhaustion', async () => {
    const controller = new HealthController(
      fakeRedis(() => Promise.reject(new Error('ERR max requests limit exceeded. Limit: 500000, Usage: 500000'))),
    );

    await expect(controller.check()).resolves.toEqual({
      status: 'degraded',
      redis: { ok: false, error: 'ERR max requests limit exceeded. Limit: 500000, Usage: 500000' },
    });
  });

  describe('when Redis never responds', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('reports degraded once the 2s timeout elapses, rather than hanging forever', async () => {
      const controller = new HealthController(fakeRedis(() => new Promise(() => {})));

      const resultPromise = controller.check();
      await vi.advanceTimersByTimeAsync(2_000);

      await expect(resultPromise).resolves.toEqual({
        status: 'degraded',
        redis: { ok: false, error: 'Redis ping timed out after 2000ms' },
      });
    });
  });
});
