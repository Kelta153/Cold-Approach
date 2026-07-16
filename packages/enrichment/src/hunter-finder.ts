import type { Business, EmailFinder, EmailFinderResult } from './types';

const HUNTER_DOMAIN_SEARCH_URL = 'https://api.hunter.io/v2/domain-search';

interface HunterDomainSearchResponse {
  data?: {
    emails?: { value: string; confidence: number }[];
  };
  errors?: { details: string }[];
}

/** Real implementation of Hunter's domain-search endpoint. Inactive unless
 * ENRICHMENT_FALLBACK=hunter (see index.ts factory) — this is not a placeholder, it's a
 * working adapter that's simply gated off by default. */
export class HunterFinder implements EmailFinder {
  constructor(private readonly apiKey = process.env.HUNTER_API_KEY ?? '') {}

  async findEmail(business: Business): Promise<EmailFinderResult> {
    const domain = business.domain ?? (business.website ? new URL(business.website).hostname.replace(/^www\./, '') : null);
    if (!domain) return { email: null, source: 'hunter: no domain to search' };
    if (!this.apiKey) return { email: null, source: 'hunter: HUNTER_API_KEY not configured' };

    const url = `${HUNTER_DOMAIN_SEARCH_URL}?domain=${encodeURIComponent(domain)}&api_key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url);
    const body = (await res.json()) as HunterDomainSearchResponse;

    if (!res.ok || !body.data?.emails?.length) {
      return { email: null, source: `hunter: domain-search returned no results for ${domain}` };
    }

    const best = body.data.emails.reduce((a, b) => (b.confidence > a.confidence ? b : a));
    return { email: best.value, source: `hunter: domain-search (${best.confidence}% confidence)` };
  }
}
