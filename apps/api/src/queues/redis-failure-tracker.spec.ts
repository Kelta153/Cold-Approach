import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessLineFindManyMock = vi.fn();
const automationStateFindUniqueMock = vi.fn();
const automationStateUpsertMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: {
    businessLine: { findMany: (...args: unknown[]) => businessLineFindManyMock(...args) },
    automationState: {
      findUnique: (...args: unknown[]) => automationStateFindUniqueMock(...args),
      upsert: (...args: unknown[]) => automationStateUpsertMock(...args),
    },
  },
}));

// `recordRedisFailureAndMaybeStartCooldown` keeps its consecutive-failure counter at module
// scope (same reasoning as `redis-error-logger.ts`'s own dedup state) — `vi.resetModules()` + a
// fresh dynamic import per test gives each test a clean slate.
async function freshTracker() {
  vi.resetModules();
  const { recordRedisFailureAndMaybeStartCooldown } = await import('./redis-failure-tracker.js');
  return recordRedisFailureAndMaybeStartCooldown;
}

describe('recordRedisFailureAndMaybeStartCooldown', () => {
  beforeEach(() => {
    businessLineFindManyMock.mockReset();
    automationStateFindUniqueMock.mockReset();
    automationStateUpsertMock.mockReset();
    businessLineFindManyMock.mockResolvedValue([{ id: 'line_1' }]);
    automationStateFindUniqueMock.mockResolvedValue(null);
  });

  it('does not write anything on the first failure', async () => {
    const record = await freshTracker();

    await record(new Error('ECONNRESET'));

    expect(businessLineFindManyMock).not.toHaveBeenCalled();
    expect(automationStateUpsertMock).not.toHaveBeenCalled();
  });

  it('starts a 7-day cooldown for every business line on the second consecutive failure', async () => {
    const record = await freshTracker();

    await record(new Error('ECONNRESET'));
    await record(new Error('ERR max requests limit exceeded'));

    expect(automationStateUpsertMock).toHaveBeenCalledTimes(1);
    expect(automationStateUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessLineId: 'line_1' },
        create: expect.objectContaining({ businessLineId: 'line_1', redisFailureCount: 2 }),
        update: expect.objectContaining({ redisFailureCount: 2 }),
      }),
    );
    const [[call]] = automationStateUpsertMock.mock.calls;
    const untilCreate = call.create.redisCooldownUntil as Date;
    const untilUpdate = call.update.redisCooldownUntil as Date;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(untilCreate.getTime()).toBeGreaterThan(Date.now() + sevenDaysMs - 5_000);
    expect(untilUpdate.getTime()).toBeGreaterThan(Date.now() + sevenDaysMs - 5_000);
  });

  it('does not stomp an already-active cooldown for a business line', async () => {
    const record = await freshTracker();
    automationStateFindUniqueMock.mockResolvedValue({
      businessLineId: 'line_1',
      redisCooldownUntil: new Date(Date.now() + 1000), // still active
    });

    await record(new Error('ECONNRESET'));
    await record(new Error('ERR max requests limit exceeded'));

    expect(automationStateUpsertMock).not.toHaveBeenCalled();
  });

  it('starts a fresh cooldown if the previous one already lapsed', async () => {
    const record = await freshTracker();
    automationStateFindUniqueMock.mockResolvedValue({
      businessLineId: 'line_1',
      redisCooldownUntil: new Date(Date.now() - 1000), // already expired
    });

    await record(new Error('ECONNRESET'));
    await record(new Error('ERR max requests limit exceeded'));

    expect(automationStateUpsertMock).toHaveBeenCalledTimes(1);
  });

  it('writes a cooldown for every business line, not just the first', async () => {
    const record = await freshTracker();
    businessLineFindManyMock.mockResolvedValue([{ id: 'line_1' }, { id: 'line_2' }]);

    await record(new Error('ECONNRESET'));
    await record(new Error('ERR max requests limit exceeded'));

    expect(automationStateUpsertMock).toHaveBeenCalledTimes(2);
  });
});
