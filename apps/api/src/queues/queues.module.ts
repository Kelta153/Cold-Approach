import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import IORedis from 'ioredis';
import { EnrichmentModule } from '../modules/enrichment/enrichment.module';
import { DraftingModule } from '../modules/drafting/drafting.module';
import { DiscoveryProcessor } from './discovery.processor';
import { DraftingProcessor } from './drafting.processor';
import { EnrichmentProcessor } from './enrichment.processor';
import { QUEUE_NAMES } from './queue-names';

export { QUEUE_NAMES };

// Constructed once and passed explicitly to every `registerQueue` entry below, rather than
// relying on `forRoot`'s shared-config auto-merge to cross module boundaries — that merge proved
// unreliable once `DiscoveryModule` (a separate module) also needed to inject the `discovery`
// queue: it silently fell back to bullmq's `redis://localhost:6379` default and spammed
// ECONNREFUSED. An explicit `connection` on each queue removes the ambiguity entirely.
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const defaultJobOptions = {
  removeOnComplete: { count: 10 },
  removeOnFail: { count: 50 },
};

/** Real BullMQ queues for each pipeline stage — discovery (Google Places) -> enrichment
 * (email find/verify) -> drafting (Claude). Connection is Upstash Redis via `REDIS_URL`.
 * `defaultJobOptions` bounds Redis memory on the free tier. Imports the feature modules whose
 * services the processors depend on (`EnrichmentService`, `DraftingService`) — `DiscoveryModule`
 * is not imported here since nothing in this module depends on it; it imports this queue instead
 * (see discovery.module.ts) to enqueue the first job. */
@Module({
  imports: [
    BullModule.forRoot({ connection, defaultJobOptions }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.discovery, connection, defaultJobOptions },
      { name: QUEUE_NAMES.enrichment, connection, defaultJobOptions },
      { name: QUEUE_NAMES.drafting, connection, defaultJobOptions },
    ),
    EnrichmentModule,
    DraftingModule,
  ],
  providers: [DiscoveryProcessor, EnrichmentProcessor, DraftingProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
