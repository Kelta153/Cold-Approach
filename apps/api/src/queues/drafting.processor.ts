import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue-names';

/** Placeholder processor — logs and marks the job complete. Real Claude-backed draft generation
 * lands in a later phase. */
@Processor(QUEUE_NAMES.drafting)
export class DraftingProcessor extends WorkerHost {
  private readonly logger = new Logger(DraftingProcessor.name);

  async process(job: Job): Promise<{ ok: true }> {
    this.logger.log(`[drafting] processing job ${job.id} (stub) — payload: ${JSON.stringify(job.data)}`);
    return { ok: true };
  }
}
