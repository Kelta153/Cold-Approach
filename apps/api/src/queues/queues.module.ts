import { BullModule } from '@nestjs/bullmq';
import { Module, Logger } from '@nestjs/common';
import IORedis from 'ioredis';
import { EnrichmentModule } from '../modules/enrichment/enrichment.module';
import { DraftingModule } from '../modules/drafting/drafting.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { DiscoveryProcessor } from './discovery.processor';
import { DraftingProcessor } from './drafting.processor';
import { EnrichmentProcessor } from './enrichment.processor';
import { QUEUE_NAMES } from './queue-names';
import { REDIS_CONNECTION } from './redis-connection.token';
import { logRedisErrorOnce } from './redis-error-logger';
import { recordRedisFailureAndMaybeStartCooldown } from './redis-failure-tracker';

export { QUEUE_NAMES, REDIS_CONNECTION };

const redisLogger = new Logger('RedisConnection');

// Constructed once and passed explicitly to every `registerQueue` entry below, rather than
// relying on `forRoot`'s shared-config auto-merge to cross module boundaries — that merge proved
// unreliable once `DiscoveryModule` (a separate module) also needed to inject the `discovery`
// queue: it silently fell back to bullmq's `redis://localhost:6379` default and spammed
// ECONNREFUSED. An explicit `connection` on each queue removes the ambiguity entirely.
//
// `maxRetriesPerRequest` MUST stay `null` — this connection is shared with BullMQ Workers, which
// issue blocking commands; bullmq's own RedisConnection class force-overrides/warns on any other
// value for blocking connections (verified in bullmq's source), so a finite value here would
// either be silently ignored or produce persistent warnings. `retryStrategy` is the correct lever
// for capping *reconnection* backoff (e.g. if Upstash drops the connection under load) — it does
// NOT apply to command-level errors on an already-open connection (ioredis never auto-retries
// those), which is what a quota-exhaustion `ReplyError` actually is. That case is instead
// addressed by reducing how often commands are attempted at all — see the `drainDelay` /
// `stalledInterval` tuning on each Worker in discovery/enrichment/drafting.processor.ts.
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(1000 * 2 ** times, 30_000),
});

connection.on('error', (err) => {
  logRedisErrorOnce(redisLogger, err);
  void recordRedisFailureAndMaybeStartCooldown(err);
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
    NotificationsModule,
  ],
  providers: [DiscoveryProcessor, EnrichmentProcessor, DraftingProcessor, { provide: REDIS_CONNECTION, useValue: connection }],
  exports: [BullModule, REDIS_CONNECTION],
})
export class QueuesModule {}
