import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import IORedis from 'ioredis';
import { DiscoveryProcessor } from './discovery.processor';
import { DraftingProcessor } from './drafting.processor';
import { EnrichmentProcessor } from './enrichment.processor';
import { QUEUE_NAMES } from './queue-names';

export { QUEUE_NAMES };

/** Placeholder BullMQ queues for each pipeline stage. Processors are stubs that log and mark the
 * job complete — real discovery/enrichment/drafting logic lands in a later phase. Connection is
 * Upstash Redis via `REDIS_URL`. `defaultJobOptions` bounds Redis memory on the free tier. */
@Module({
  imports: [
    BullModule.forRoot({
      connection: new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
        maxRetriesPerRequest: null,
      }),
      defaultJobOptions: {
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 50 },
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.discovery },
      { name: QUEUE_NAMES.enrichment },
      { name: QUEUE_NAMES.drafting },
    ),
  ],
  providers: [DiscoveryProcessor, EnrichmentProcessor, DraftingProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
