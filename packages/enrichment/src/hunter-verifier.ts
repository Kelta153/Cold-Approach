import type { EmailVerifier, EmailVerifierResult, VerifyStatus } from './types';

const HUNTER_VERIFIER_URL = 'https://api.hunter.io/v2/email-verifier';

interface HunterVerifierResponse {
  data?: { status?: string };
}

const STATUS_MAP: Record<string, VerifyStatus> = {
  valid: 'valid',
  invalid: 'invalid',
};

/** Real implementation of Hunter's email-verifier endpoint. Inactive unless
 * ENRICHMENT_FALLBACK=hunter (see index.ts factory). */
export class HunterVerifier implements EmailVerifier {
  constructor(private readonly apiKey = process.env.HUNTER_API_KEY ?? '') {}

  async verify(email: string): Promise<EmailVerifierResult> {
    if (!this.apiKey) return { status: 'unknown' };

    const url = `${HUNTER_VERIFIER_URL}?email=${encodeURIComponent(email)}&api_key=${encodeURIComponent(this.apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) return { status: 'unknown' };

    const body = (await res.json()) as HunterVerifierResponse;
    return { status: STATUS_MAP[body.data?.status ?? ''] ?? 'unknown' };
  }
}
