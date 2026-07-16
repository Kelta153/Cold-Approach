import { resolveMx } from 'node:dns/promises';
import type { EmailVerifier, EmailVerifierResult } from './types';

/** Active by default (ENRICHMENT_FALLBACK=none). Confirms the email's domain has at least
 * one MX record — a cheap, dependency-free signal, not full mailbox verification. */
export class MxRecordVerifier implements EmailVerifier {
  async verify(email: string): Promise<EmailVerifierResult> {
    const domain = email.split('@')[1];
    if (!domain) return { status: 'invalid' };

    try {
      const records = await resolveMx(domain);
      return { status: records.length > 0 ? 'valid' : 'invalid' };
    } catch {
      return { status: 'unknown' };
    }
  }
}
