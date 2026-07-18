import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue-names';

/** Placeholder processor — logs and marks the job complete. Wiring this up to
 * `EnrichmentService.findEmail`/`verifyEmail` for real batch processing is a later phase. */
@Processor(QUEUE_NAMES.enrichment)
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  async process(job: Job): Promise<{ ok: true }> {
    this.logger.log(`[enrichment] processing job ${job.id} (stub) — payload: ${JSON.stringify(job.data)}`);
    return { ok: true };
  }
}
