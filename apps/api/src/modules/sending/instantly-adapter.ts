import { Logger } from '@nestjs/common';

export interface InstantlySendRequest {
  to: string;
  subject: string;
  body: string;
  fromInbox: string;
}

export interface InstantlySendResult {
  providerMessageId: string | null;
  simulated: boolean;
}

const logger = new Logger('InstantlyAdapter');

/**
 * The only place that talks to Instantly. Isolated from the compliance chokepoint on purpose —
 * the 5 checks (verified/suppressed/footer/warm-up/cap) run and gate the send regardless of
 * whether this adapter is live or simulated; this function only decides HOW an already-approved
 * send actually goes out.
 *
 * With no `INSTANTLY_API_KEY`, this skips the network call entirely and returns a simulated
 * result — the caller still creates a real `Send` row (so the operator sees the real
 * approve → chokepoint → "sent" flow work end to end), but `simulated: true` must be persisted
 * and surfaced, never silently indistinguishable from a real send. Same on/off pattern as the
 * Hunter enrichment fallback in packages/enrichment: flip `INSTANTLY_API_KEY` in and this
 * function starts making real calls with no other code changes required.
 */
export async function sendViaInstantly(request: InstantlySendRequest): Promise<InstantlySendResult> {
  const apiKey = process.env.INSTANTLY_API_KEY;

  if (!apiKey) {
    logger.warn(`SIMULATED SEND (no INSTANTLY_API_KEY) — would send to ${request.to} from ${request.fromInbox}. No real email was sent.`);
    return { providerMessageId: null, simulated: true };
  }

  const response = await fetch('https://api.instantly.ai/api/v2/emails/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: request.to,
      subject: request.subject,
      body: { html: request.body },
      from: request.fromInbox,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Instantly send failed: ${response.status} ${text}`);
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { providerMessageId: data.id ?? null, simulated: false };
}
