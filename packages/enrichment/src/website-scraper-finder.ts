import type { Business, EmailFinder, EmailFinderResult } from './types';

const MAILTO_RE = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** Active by default (ENRICHMENT_FALLBACK=none). Fetches the business's homepage and
 * looks for a mailto: link or a bare email address — no third-party API dependency. */
export class WebsiteScraperFinder implements EmailFinder {
  async findEmail(business: Business): Promise<EmailFinderResult> {
    if (!business.website) return { email: null, source: 'website-scraper: no website on record' };

    try {
      const res = await fetch(business.website, { redirect: 'follow' });
      const html = await res.text();
      const mailto = html.match(MAILTO_RE);
      if (mailto) return { email: mailto[1], source: `website-scraper: mailto link on ${business.website}` };

      const bare = html.match(EMAIL_RE);
      if (bare) return { email: bare[0], source: `website-scraper: address found on ${business.website}` };

      return { email: null, source: `website-scraper: no address found on ${business.website}` };
    } catch {
      return { email: null, source: `website-scraper: failed to fetch ${business.website}` };
    }
  }
}
