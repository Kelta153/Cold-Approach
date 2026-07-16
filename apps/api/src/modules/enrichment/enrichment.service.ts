import { Injectable, Logger } from '@nestjs/common';
import { createEnrichmentAdapters, type EnrichmentAdapters } from '@outreach-engine/enrichment';

/**
 * Thin wrapper around `@outreach-engine/enrichment`'s `createEnrichmentAdapters()` factory. The
 * adapter wiring itself is real (respects `ENRICHMENT_FALLBACK`); the call sites below are
 * stubs — no real discovery→enrichment pipeline exists yet, they just log and return so the
 * module tree and DI wiring are in place for Phase 4 to build on.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  private readonly adapters: EnrichmentAdapters;

  constructor() {
    this.adapters = createEnrichmentAdapters();
  }

  /** Stub call site — logs and returns the finder's result. No batching, no persistence, no
   * retry logic yet; that is the discovery/enrichment pipeline itself, out of scope for Phase 1. */
  async findEmail(business: { name: string; website: string | null; domain?: string | null }) {
    this.logger.log(`findEmail stub called for ${business.name}`);
    return this.adapters.finder.findEmail(business);
  }

  /** Stub call site — logs and returns the verifier's result. */
  async verifyEmail(email: string) {
    this.logger.log(`verifyEmail stub called for ${email}`);
    return this.adapters.verifier.verify(email);
  }
}
