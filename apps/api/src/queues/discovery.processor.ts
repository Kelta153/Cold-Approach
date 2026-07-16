import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from './queues.module';

/** Placeholder processor — logs and marks the job complete. Real Google Places-backed discovery
 * logic lands in a later phase. */
@Processor(QUEUE_NAMES.discovery)
export class DiscoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DiscoveryProcessor.name);

  async process(job: Job): Promise<{ ok: true }> {
    this.logger.log(`[discovery] processing job ${job.id} (stub) — payload: ${JSON.stringify(job.data)}`);
    return { ok: true };
  }
}
