import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { prisma, type EmailStatus } from '@outreach-engine/db';
import type { VerifyStatus } from '@outreach-engine/enrichment';
import { EnrichmentService } from '../modules/enrichment/enrichment.service';
import { updateBatchStats } from '../modules/discovery/batch-stats';
import { QUEUE_NAMES } from './queue-names';
import type { DraftingJobPayload, EnrichmentJobPayload } from './job-payloads';

const VERIFY_TO_EMAIL_STATUS: Record<VerifyStatus, EmailStatus> = {
  valid: 'valid',
  invalid: 'invalid',
  unknown: 'unverified',
};

/** Real enrichment: finds + verifies an email for the lead's business via
 * `@outreach-engine/enrichment`'s adapters (free website-scrape/MX-record path by default; Hunter
 * when `ENRICHMENT_FALLBACK=hunter`), persists the result on the `Lead`, then hands off to
 * drafting regardless of whether an email was found — a failed find is still worth a draft, the
 * compliance chokepoint is what actually gates sending later. */
@Processor(QUEUE_NAMES.enrichment)
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(
    @Inject(EnrichmentService) private readonly enrichmentService: EnrichmentService,
    @InjectQueue(QUEUE_NAMES.drafting) private readonly draftingQueue: Queue<DraftingJobPayload>,
  ) {
    super();
  }

  async process(job: Job<EnrichmentJobPayload>): Promise<{ email: string | null }> {
    const { batchId, leadId, businessLineId } = job.data;
    const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId }, include: { business: true } });

    const found = await this.enrichmentService.findEmail({ name: lead.business.name, website: lead.business.website });

    let email: string | null = found.email;
    let emailStatus: EmailStatus = 'not_found';
    if (email) {
      const verified = await this.enrichmentService.verifyEmail(email);
      emailStatus = VERIFY_TO_EMAIL_STATUS[verified.status];
    }

    await prisma.lead.update({ where: { id: leadId }, data: { email, emailStatus } });

    this.logger.log(`[enrichment] lead ${leadId}: ${email ?? 'no email found'} (${emailStatus}) — ${found.source}`);
    await updateBatchStats(batchId, (stats) => {
      stats.enriched += 1;
    });

    await this.draftingQueue.add('draft', { batchId, leadId, businessLineId });
    return { email };
  }
}
