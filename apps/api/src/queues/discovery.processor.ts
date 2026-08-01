import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { prisma } from '@outreach-engine/db';
import { searchBusinesses } from '../modules/discovery/google-places.client';
import { updateBatchStats } from '../modules/discovery/batch-stats';
import { QUEUE_NAMES } from './queue-names';
import type { DiscoveryJobPayload, EnrichmentJobPayload } from './job-payloads';
import { logRedisErrorOnce } from './redis-error-logger';
import { recordRedisFailureAndMaybeStartCooldown } from './redis-failure-tracker';

/** Real Google Places-backed discovery. For each place returned by the text search: skip
 * exclusions, dedupe against an existing `Business.googlePlaceId`, skip anything already
 * suppressed for this business line, then create `Business` + `Lead` rows and hand each new lead
 * off to the `enrichment` queue.
 *
 * `drainDelay`/`stalledInterval` are raised well above BullMQ's defaults (5s / 30s) — this queue
 * is driven by manual, infrequent admin-triggered batches, not continuous throughput, so the
 * default idle-polling cadence burns Redis commands 24/7 for essentially no benefit (this was the
 * actual root cause of exhausting Upstash's monthly command quota, not job-processing volume).
 * Blocking waits still return the instant a real job is enqueued, so this doesn't add latency to
 * a triggered batch — it only reduces how often an idle worker checks in for nothing. */
@Processor(QUEUE_NAMES.discovery, { drainDelay: 120, stalledInterval: 300_000 })
export class DiscoveryProcessor extends WorkerHost {
  private readonly logger = new Logger(DiscoveryProcessor.name);

  constructor(@InjectQueue(QUEUE_NAMES.enrichment) private readonly enrichmentQueue: Queue<EnrichmentJobPayload>) {
    super();
  }

  @OnWorkerEvent('error')
  onError(err: Error) {
    logRedisErrorOnce(this.logger, err);
    void recordRedisFailureAndMaybeStartCooldown(err);
  }

  async process(job: Job<DiscoveryJobPayload>): Promise<{ leadsCreated: number }> {
    const { batchId, businessLineId, profileId, productId, geography, sizeRequested } = job.data;
    this.logger.log(`[discovery] batch ${batchId}: searching Google Places for "${geography}"`);

    const profile = await prisma.targetingProfile.findUniqueOrThrow({ where: { id: profileId } });
    const queryText = [...profile.keywords, geography].filter(Boolean).join(' ');

    const places = await searchBusinesses(queryText, sizeRequested * 2);
    await updateBatchStats(batchId, (stats) => {
      stats.placesCalls += 1;
    });

    const exclusions = profile.exclusions.map((e) => e.toLowerCase());
    let created = 0;

    for (const place of places) {
      if (created >= sizeRequested) break;
      if (exclusions.some((ex) => place.name.toLowerCase().includes(ex))) {
        this.logger.log(`[discovery] skip "${place.name}" — matches exclusion`);
        continue;
      }

      const existingBusiness = await prisma.business.findUnique({ where: { googlePlaceId: place.placeId } });
      if (existingBusiness) {
        const existingLead = await prisma.lead.findFirst({
          where: { businessLineId, businessId: existingBusiness.id },
        });
        if (existingLead) {
          this.logger.log(`[discovery] skip "${place.name}" — already discovered for this business line`);
          continue;
        }
      }

      const suppressed = await prisma.suppressionEntry.findFirst({
        where: { businessLineId, googlePlaceId: place.placeId },
      });
      if (suppressed) {
        this.logger.log(`[discovery] skip "${place.name}" — on suppression list`);
        continue;
      }

      const business =
        existingBusiness ??
        (await prisma.business.create({
          data: {
            businessLineId,
            googlePlaceId: place.placeId,
            name: place.name,
            category: place.category,
            address: place.address,
            phone: place.phone,
            website: place.website,
            rating: place.rating,
            reviewCount: place.reviewCount,
            source: 'google_places',
          },
        }));

      const lead = await prisma.lead.create({
        data: { businessLineId, businessId: business.id, productId, channel: 'email', status: 'discovered' },
      });

      created += 1;
      await updateBatchStats(batchId, (stats) => {
        stats.discovered += 1;
      });
      await this.enrichmentQueue.add('enrich', { batchId, leadId: lead.id, businessLineId });
    }

    await updateBatchStats(batchId, (stats) => {
      stats.totalLeads = created;
      stats.status = created > 0 ? 'enriching' : 'complete';
    });

    this.logger.log(`[discovery] batch ${batchId}: created ${created}/${sizeRequested} leads from ${places.length} results`);
    return { leadsCreated: created };
  }
}
