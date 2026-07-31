import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `logRedisErrorOnce` keeps its dedup/cooldown state at module scope (see its own doc comment) —
// `vi.resetModules()` + a fresh dynamic import per test gives each test a clean slate rather than
// fighting state left over from a previous test.
async function freshLogger() {
  vi.resetModules();
  const { logRedisErrorOnce } = await import('./redis-error-logger.js');
  return logRedisErrorOnce;
}

function silentLogger(): Logger {
  return { error: vi.fn() } as unknown as Logger;
}

describe('logRedisErrorOnce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs the first occurrence of a message immediately', async () => {
    const logRedisErrorOnce = await freshLogger();
    const logger = silentLogger();

    logRedisErrorOnce(logger, new Error('quota exceeded'));

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('Redis error: quota exceeded');
  });

  it('does not log the same message again within the cooldown window', async () => {
    const logRedisErrorOnce = await freshLogger();
    const logger = silentLogger();

    logRedisErrorOnce(logger, new Error('quota exceeded'));
    for (let i = 0; i < 50; i++) logRedisErrorOnce(logger, new Error('quota exceeded'));

    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('logs again, with a suppressed count, once the cooldown window has passed', async () => {
    const logRedisErrorOnce = await freshLogger();
    const logger = silentLogger();

    logRedisErrorOnce(logger, new Error('quota exceeded'));
    for (let i = 0; i < 5; i++) logRedisErrorOnce(logger, new Error('quota exceeded'));

    vi.advanceTimersByTime(60_000);
    logRedisErrorOnce(logger, new Error('quota exceeded'));

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenLastCalledWith('Redis error (still occurring — 6 more since last log): quota exceeded');
  });

  it('logs immediately when the message changes, resetting the cooldown state', async () => {
    const logRedisErrorOnce = await freshLogger();
    const logger = silentLogger();

    logRedisErrorOnce(logger, new Error('quota exceeded'));
    logRedisErrorOnce(logger, new Error('connection reset'));

    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenLastCalledWith('Redis error: connection reset');
  });
});
