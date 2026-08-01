import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateBatchDto } from '@outreach-engine/types';
import type { BusinessLineContext } from '../../common/business-line-scope/business-line-context';

const automationStateFindUniqueMock = vi.fn();
const automationStateUpsertMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: {
    automationState: {
      findUnique: (...args: unknown[]) => automationStateFindUniqueMock(...args),
      upsert: (...args: unknown[]) => automationStateUpsertMock(...args),
    },
  },
}));

import { DiscoveryService } from './discovery.service';

const DTO: CreateBatchDto = { profileId: 'profile_1', productId: 'product_1', geography: 'Bristol, UK', sizeRequested: 10 };

function makeBusinessLineContext(overrides: { targetingProfile?: unknown; product?: unknown; batch?: unknown } = {}): BusinessLineContext {
  return {
    getBusinessLineId: () => 'line_1',
    db: {
      targetingProfile: { findFirst: vi.fn().mockResolvedValue(overrides.targetingProfile ?? { id: 'profile_1' }) },
      product: { findFirst: vi.fn().mockResolvedValue(overrides.product ?? { id: 'product_1' }) },
      batch: { create: vi.fn().mockResolvedValue(overrides.batch ?? { id: 'batch_1' }) },
    },
  } as unknown as BusinessLineContext;
}

function makeQueue() {
  return { add: vi.fn().mockResolvedValue(undefined) };
}

describe('DiscoveryService.runBatch — Redis cooldown gating', () => {
  beforeEach(() => {
    automationStateFindUniqueMock.mockReset();
    automationStateUpsertMock.mockReset();
  });

  it('blocks the batch and never touches the queue while a cooldown is active', async () => {
    automationStateFindUniqueMock.mockResolvedValue({ redisCooldownUntil: new Date(Date.now() + 60_000) });
    const businessLineContext = makeBusinessLineContext();
    const queue = makeQueue();
    const service = new DiscoveryService(businessLineContext, queue as never);

    await expect(service.runBatch(DTO, 'user_1')).rejects.toThrow(/Blocked: Redis has been in a known-bad state/);

    expect(queue.add).not.toHaveBeenCalled();
    expect((businessLineContext.db as never as { batch: { create: ReturnType<typeof vi.fn> } }).batch.create).not.toHaveBeenCalled();
  });

  it('proceeds normally when no cooldown is recorded', async () => {
    automationStateFindUniqueMock.mockResolvedValue(null);
    const businessLineContext = makeBusinessLineContext();
    const queue = makeQueue();
    const service = new DiscoveryService(businessLineContext, queue as never);

    const result = await service.runBatch(DTO, 'user_1');

    expect(result).toEqual({ batchId: 'batch_1' });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('proceeds normally once a previous cooldown has lapsed', async () => {
    automationStateFindUniqueMock.mockResolvedValue({ redisCooldownUntil: new Date(Date.now() - 60_000) });
    const businessLineContext = makeBusinessLineContext();
    const queue = makeQueue();
    const service = new DiscoveryService(businessLineContext, queue as never);

    const result = await service.runBatch(DTO, 'user_1');

    expect(result).toEqual({ batchId: 'batch_1' });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});

describe('DiscoveryService.getRedisCooldownStatus', () => {
  beforeEach(() => {
    automationStateFindUniqueMock.mockReset();
  });

  it('reports inactive when no cooldown row exists', async () => {
    automationStateFindUniqueMock.mockResolvedValue(null);
    const service = new DiscoveryService(makeBusinessLineContext(), makeQueue() as never);

    await expect(service.getRedisCooldownStatus()).resolves.toEqual({ active: false, until: null });
  });

  it('reports active with the until timestamp while a cooldown is in effect', async () => {
    const until = new Date(Date.now() + 60_000);
    automationStateFindUniqueMock.mockResolvedValue({ redisCooldownUntil: until });
    const service = new DiscoveryService(makeBusinessLineContext(), makeQueue() as never);

    await expect(service.getRedisCooldownStatus()).resolves.toEqual({ active: true, until: until.toISOString() });
  });
});

describe('DiscoveryService.clearRedisCooldown', () => {
  beforeEach(() => {
    automationStateUpsertMock.mockReset();
  });

  it('resets redisFailureCount and redisCooldownUntil for the resolved business line', async () => {
    const service = new DiscoveryService(makeBusinessLineContext(), makeQueue() as never);

    await service.clearRedisCooldown();

    expect(automationStateUpsertMock).toHaveBeenCalledWith({
      where: { businessLineId: 'line_1' },
      create: { businessLineId: 'line_1', redisFailureCount: 0, redisCooldownUntil: null },
      update: { redisFailureCount: 0, redisCooldownUntil: null },
    });
  });
});
