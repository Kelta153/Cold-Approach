import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { prisma } from '@outreach-engine/db';
import { DraftingService } from '../modules/drafting/drafting.service';
import { updateBatchStats } from '../modules/discovery/batch-stats';
import { QUEUE_NAMES } from './queue-names';
import type { DraftingJobPayload } from './job-payloads';
import { logRedisErrorOnce } from './redis-error-logger';

/** Real Claude-backed draft generation. Loads the lead's business, the batch's product, and the
 * business line (for sender identity + compliance footer), calls `DraftingService`, and writes
 * the resulting `Draft` row — the same row shape the review queue already reads.
 *
 * `drainDelay`/`stalledInterval` raised for the same reason as `discovery.processor.ts` — see
 * that file's comment. */
@Processor(QUEUE_NAMES.drafting, { drainDelay: 120, stalledInterval: 300_000 })
export class DraftingProcessor extends WorkerHost {
  private readonly logger = new Logger(DraftingProcessor.name);

  constructor(@Inject(DraftingService) private readonly draftingService: DraftingService) {
    super();
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    logRedisErrorOnce(this.logger, err);
  }

  async process(job: Job<DraftingJobPayload>): Promise<{ draftId: string }> {
    const { batchId, leadId } = job.data;
    const lead = await prisma.lead.findUniqueOrThrow({
      where: { id: leadId },
      include: { business: true, product: true, businessLine: true },
    });

    const template = await prisma.template.findFirst({
      where: { businessLineId: lead.businessLineId, type: 'email_outbound', active: true },
      orderBy: { createdAt: 'desc' },
    });

    try {
      const draft = await this.draftingService.draftEmail({
        business: {
          name: lead.business.name,
          category: lead.business.category,
          address: lead.business.address,
          website: lead.business.website,
        },
        product: {
          name: lead.product.name,
          description: lead.product.description,
          keyFeatures: lead.product.keyFeatures,
          link: lead.product.link,
        },
        businessLine: {
          senderName: lead.businessLine.senderName,
          companyLegalName: lead.businessLine.companyLegalName,
          postalAddress: lead.businessLine.postalAddress,
        },
        templateHint: template?.bodySkeleton ?? null,
      });

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
