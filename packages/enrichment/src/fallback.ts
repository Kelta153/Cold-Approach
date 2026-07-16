import type { Business, EmailFinder, EmailFinderResult, EmailVerifier, EmailVerifierResult } from './types';

/** Tries the primary implementation first; only calls the fallback when the primary
 * comes back empty/unknown. Used when ENRICHMENT_FALLBACK=hunter — Hunter augments the
 * free methods rather than replacing them outright. */
export class FallbackEmailFinder implements EmailFinder {
  constructor(private readonly primary: EmailFinder, private readonly fallback: EmailFinder) {}

  async findEmail(business: Business): Promise<EmailFinderResult> {
    const primaryResult = await this.primary.findEmail(business);
    if (primaryResult.email) return primaryResult;
    return this.fallback.findEmail(business);
  }
}

export class FallbackEmailVerifier implements EmailVerifier {
  constructor(private readonly primary: EmailVerifier, private readonly fallback: EmailVerifier) {}

  async verify(email: string): Promise<EmailVerifierResult> {
    const primaryResult = await this.primary.verify(email);
    if (primaryResult.status !== 'unknown') return primaryResult;
    return this.fallback.verify(email);
  }
}
