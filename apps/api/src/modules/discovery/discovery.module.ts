import { Module } from '@nestjs/common';
import { QueuesModule } from '../../queues/queues.module';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { DiscoveryService } from './discovery.service';

/** Imports `QueuesModule` (rather than its own `BullModule.registerQueue` call) so
 * `DiscoveryService` injects the exact same `discovery` Queue instance QueuesModule already
 * configured with the shared Redis connection — a second `registerQueue({name: 'discovery'})`
 * call from this module resolved the global shared-connection config inconsistently and fell
 * back to bullmq's `redis://localhost:6379` default, spamming ECONNREFUSED. */
@Module({
  imports: [QueuesModule],
  controllers: [BatchesController],
  providers: [DiscoveryService, BatchesService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
