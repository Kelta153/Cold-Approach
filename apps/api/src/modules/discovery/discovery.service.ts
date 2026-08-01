import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { prisma } from '@outreach-engine/db';
import type { CreateBatchDto } from '@outreach-engine/types';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';
import { QUEUE_NAMES } from '../../queues/queue-names';
import type { DiscoveryJobPayload } from '../../queues/job-payloads';
import { initialBatchStats } from './batch-stats';

/** Trigger side of discovery — creates the audit `Batch` row and hands off to the `discovery`
 * BullMQ queue. The queue processor (apps/api/src/queues/discovery.processor.ts) does the actual
 * Google Places work; this service only owns request-scoped validation and enqueueing.
 *
 * The Redis-cooldown check below queries `AutomationState` via the raw `prisma` singleton rather
 * than `BusinessLineContext.db` — the row's sole key is the `businessLineId` this service already
 * has in hand, so there's nothing for the scoped-Prisma extension to add here, and it keeps this
 * check reusable outside a request context later if needed (same reasoning as the BullMQ
 * processors, which already use the raw singleton for this exact reason). */
@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(BusinessLineContext) private readonly businessLineContext: BusinessLineContext,
    @InjectQueue(QUEUE_NAMES.discovery) private readonly discoveryQueue: Queue<DiscoveryJobPayload>,
  ) {}

  async runBatch(dto: CreateBatchDto, runByUserId: string): Promise<{ batchId: string }> {
    const businessLineId = this.businessLineContext.getBusinessLineId();

    const cooldown = await this.getRedisCooldownState(businessLineId);
    if (cooldown.active) {
      throw new ServiceUnavailableException(
        `Blocked: Redis has been in a known-bad state, cooldown active until ${cooldown.until?.toISOString()}. ` +
          `Clear it from the Batches page once you've confirmed Upstash's quota has actually reset.`,
      );
    }

    const [profile, product] = await Promise.all([
      this.businessLineContext.db.targetingProfile.findFirst({ where: { id: dto.profileId } }),
      this.businessLineContext.db.product.findFirst({ where: { id: dto.productId } }),
    ]);
    if (!profile) throw new NotFoundException(`Targeting profile ${dto.profileId} not found in this business line.`);
    if (!product) throw new NotFoundException(`Product ${dto.productId} not found in this business line.`);

    const batch = await this.businessLineContext.db.batch.create({
      data: {
        businessLineId,
        profileId: dto.profileId,
        productId: dto.productId,
        geography: dto.geography,
        channel: 'email',
        sizeRequested: dto.sizeRequested,
        stats: initialBatchStats() as unknown as object,
        runBy: runByUserId,
      },
    });

    await this.discoveryQueue.add('discover', {
      batchId: batch.id,
      businessLineId,
      profileId: dto.profileId,
      productId: dto.productId,
      geography: dto.geography,
      sizeRequested: dto.sizeRequested,
    });

    return { batchId: batch.id };
  }

  /** Read-only status for the Batches admin page's cooldown banner (see `BatchesController`) —
   * distinct from `/health`'s `redis.ok`, which reflects Redis's *current* reachability, not
   * whether the longer-lived 7-day cooldown is still active (the two can disagree: Redis can
   * recover while the cooldown remains in effect until an admin clears it). */
  async getRedisCooldownStatus(): Promise<{ active: boolean; until: string | null }> {
    const businessLineId = this.businessLineContext.getBusinessLineId();
    const cooldown = await this.getRedisCooldownState(businessLineId);
    return { active: cooldown.active, until: cooldown.until?.toISOString() ?? null };
  }

  /** Admin-only escape hatch (see `BatchesController`) — ends an active Redis-outage cooldown
   * early, e.g. once an admin has confirmed Upstash's quota actually reset. A successful Redis
   * command never clears this automatically, by design; only an explicit admin action does. */
  async clearRedisCooldown(): Promise<void> {
    const businessLineId = this.businessLineContext.getBusinessLineId();
    await prisma.automationState.upsert({
      where: { businessLineId },
      create: { businessLineId, redisFailureCount: 0, redisCooldownUntil: null },
      update: { redisFailureCount: 0, redisCooldownUntil: null },
    });
  }

  private async getRedisCooldownState(businessLineId: string): Promise<{ active: boolean; until: Date | null }> {
    const automationState = await prisma.automationState.findUnique({ where: { businessLineId } });
    const until = automationState?.redisCooldownUntil ?? null;
    return { active: until !== null && until > new Date(), until };
  }
}
