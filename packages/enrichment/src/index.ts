import { FallbackEmailFinder, FallbackEmailVerifier } from './fallback';
import { HunterFinder } from './hunter-finder';
import { HunterVerifier } from './hunter-verifier';
import { MxRecordVerifier } from './mx-record-verifier';
import { WebsiteScraperFinder } from './website-scraper-finder';

export * from './types';
export { WebsiteScraperFinder } from './website-scraper-finder';
export { MxRecordVerifier } from './mx-record-verifier';
export { HunterFinder } from './hunter-finder';
export { HunterVerifier } from './hunter-verifier';
export { FallbackEmailFinder, FallbackEmailVerifier } from './fallback';

export interface EnrichmentAdapters {
  finder: import('./types').EmailFinder;
  verifier: import('./types').EmailVerifier;
}

/** No other code should care which implementation is active — call this factory and use
 * whatever it returns. Controlled entirely by ENRICHMENT_FALLBACK ("none" | "hunter"). */
export function createEnrichmentAdapters(env: { ENRICHMENT_FALLBACK?: string } = process.env): EnrichmentAdapters {
  const primaryFinder = new WebsiteScraperFinder();
  const primaryVerifier = new MxRecordVerifier();

  if (env.ENRICHMENT_FALLBACK !== 'hunter') {
    return { finder: primaryFinder, verifier: primaryVerifier };
  }

  return {
    finder: new FallbackEmailFinder(primaryFinder, new HunterFinder()),
    verifier: new FallbackEmailVerifier(primaryVerifier, new HunterVerifier()),
  };
}
