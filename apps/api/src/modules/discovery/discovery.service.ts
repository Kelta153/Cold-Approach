import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { CreateBatchDto } from '@outreach-engine/types';
import { BusinessLineContext } from '../../common/business-line-scope/business-line-context';
import { QUEUE_NAMES } from '../../queues/queue-names';
import type { DiscoveryJobPayload } from '../../queues/job-payloads';
import { initialBatchStats } from './batch-stats';

/** Trigger side of discovery — creates the audit `Batch` row and hands off to the `discovery`
 * BullMQ queue. The queue processor (apps/api/src/queues/discovery.processor.ts) does the actual
 * Google Places work; this service only owns request-scoped validation and enqueueing. */
@Injectable()
export class DiscoveryService {
  constructor(
    @Inject(BusinessLineContext) private readonly businessLineContext: BusinessLineContext,
    @InjectQueue(QUEUE_NAMES.discovery) private readonly discoveryQueue: Queue<DiscoveryJobPayload>,
  ) {}

  async runBatch(dto: CreateBatchDto, runByUserId: string): Promise<{ batchId: string }> {
    const businessLineId = this.businessLineContext.getBusinessLineId();

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
}
