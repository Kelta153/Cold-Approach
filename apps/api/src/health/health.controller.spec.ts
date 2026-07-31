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

  describe('circuit breaker — stops re-pinging Redis while a failure is fresh', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens the circuit after a failure and returns the cached result as stale, without pinging again', async () => {
      const ping = vi.fn().mockRejectedValue(new Error('ERR max requests limit exceeded'));
      const controller = new HealthController(fakeRedis(ping));

      await controller.check();
      const second = await controller.check();

      expect(ping).toHaveBeenCalledTimes(1);
      expect(second).toEqual({ status: 'degraded', redis: { ok: false, error: 'ERR max requests limit exceeded', stale: true } });
    });

    it('re-pings once the backoff window elapses', async () => {
      const ping = vi.fn().mockRejectedValue(new Error('ERR max requests limit exceeded'));
      const controller = new HealthController(fakeRedis(ping));

      await controller.check();
      await vi.advanceTimersByTimeAsync(30_000);
      await controller.check();

      expect(ping).toHaveBeenCalledTimes(2);
    });

    it('grows the backoff on repeated failures, capped at 5 minutes', async () => {
      const ping = vi.fn().mockRejectedValue(new Error('still broken'));
      const controller = new HealthController(fakeRedis(ping));

      await controller.check(); // failure 1 -> 30s backoff
      await vi.advanceTimersByTimeAsync(30_000);
      await controller.check(); // failure 2 -> 60s backoff
      await vi.advanceTimersByTimeAsync(59_000);
      const stillStale = await controller.check();
      expect(stillStale.redis).toEqual({ ok: false, error: 'still broken', stale: true });
      expect(ping).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(1_000);
      await controller.check();
      expect(ping).toHaveBeenCalledTimes(3);
    });

    it('fully closes the circuit on a successful re-check, resuming real pings every call', async () => {
      const ping = vi.fn().mockRejectedValueOnce(new Error('blip')).mockResolvedValue('PONG');
      const controller = new HealthController(fakeRedis(ping));

      await controller.check();
      await vi.advanceTimersByTimeAsync(30_000);
      const recovered = await controller.check();
      expect(recovered).toEqual({ status: 'ok', redis: { ok: true } });

      await controller.check();
      expect(ping).toHaveBeenCalledTimes(3);
    });
  });
});
