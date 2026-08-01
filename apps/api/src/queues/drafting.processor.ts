import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { prisma } from '@outreach-engine/db';
import { DraftingService } from '../modules/drafting/drafting.service';
import { loadDraftGroundingInput } from '../modules/drafting/load-draft-input';
import { updateBatchStats } from '../modules/discovery/batch-stats';
import { TelegramService } from '../modules/notifications/telegram.service';
import { QUEUE_NAMES } from './queue-names';
import type { DraftingJobPayload } from './job-payloads';
import { logRedisErrorOnce } from './redis-error-logger';
import { recordRedisFailureAndMaybeStartCooldown } from './redis-failure-tracker';

/** Real Claude-backed draft generation. Loads the lead's business, the batch's product, and the
 * business line (for sender identity + compliance footer), calls `DraftingService`, and writes
 * the resulting `Draft` row — the same row shape the review queue already reads.
 *
 * `drainDelay`/`stalledInterval` raised for the same reason as `discovery.processor.ts` — see
 * that file's comment. */
@Processor(QUEUE_NAMES.drafting, { drainDelay: 120, stalledInterval: 300_000 })
export class DraftingProcessor extends WorkerHost {
  private readonly logger = new Logger(DraftingProcessor.name);

  constructor(
    @Inject(DraftingService) private readonly draftingService: DraftingService,
    @Inject(TelegramService) private readonly telegramService: TelegramService,
  ) {
    super();
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    logRedisErrorOnce(this.logger, err);
    void recordRedisFailureAndMaybeStartCooldown(err);
  }

  async process(job: Job<DraftingJobPayload>): Promise<{ draftId: string }> {
    const { batchId, leadId } = job.data;

    try {
      const input = await loadDraftGroundingInput(leadId);
      const draft = await this.draftingService.draftEmail(input);

      const created = await prisma.draft.create({
        data: {
          leadId,
          subject: draft.subject,
          body: draft.body,
          groundingFacts: draft.groundingFacts,
          openPlaceholders: draft.openPlaceholders,
          model: draft.model,
          version: 1,
        },
      });

      await prisma.lead.update({ where: { id: leadId }, data: { status: 'drafted' } });
      await updateBatchStats(batchId, (stats) => {
        stats.drafted += 1;
        stats.anthropicCalls += 1;
      });

      this.logger.log(`[drafting] lead ${leadId}: created draft ${created.id}`);

      // Best-effort — a Telegram hiccup shouldn't fail (and retry) an otherwise-successful
      // drafting job. The draft already exists and is visible in the Review queue regardless.
      try {
        await this.telegramService.notifyDraftReady({
          draftId: created.id,
          leadId,
          company: input.business.name,
          subject: draft.subject,
          body: draft.body,
        });
      } catch (notifyErr) {
        this.logger.error(`[drafting] lead ${leadId}: draft ${created.id} created, but notifying Telegram failed: ${(notifyErr as Error).message}`);
      }

      return { draftId: created.id };
    } catch (err) {
      this.logger.error(`[drafting] lead ${leadId} failed: ${(err as Error).message}`);
      await updateBatchStats(batchId, (stats) => {
        stats.failed += 1;
      });
      throw err;
    }
  }
}
