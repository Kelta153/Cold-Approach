import { prisma } from '@outreach-engine/db';

export interface LeadClaim {
  claimed: boolean;
  alreadyHandledReason?: string;
}

/**
 * Atomically transitions a `Lead` from `'drafted'` to `'queued'` — the "someone is deciding this
 * right now" marker. `queued` was already a defined `LeadStatus` value, never assigned anywhere
 * before this. Backing this with a conditional `updateMany` (not a plain `update`) is the actual
 * fix: only one of two near-simultaneous requests for the same lead (Approve via webapp, Reject
 * via Telegram, a second Approve click, etc.) will see `count === 1` and be allowed to proceed —
 * the other sees `count === 0` and must not act. This is the single enforcement point; every
 * decision-making action (attemptSend, rejectLead, skipLead, regenerate) must call this before
 * doing anything irreversible, not just before the ones that looked risky.
 */
export async function claimLeadForDecision(leadId: string): Promise<LeadClaim> {
  const result = await prisma.lead.updateMany({
    where: { id: leadId, status: 'drafted' },
    data: { status: 'queued' },
  });

  if (result.count === 1) {
    return { claimed: true };
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { sends: { orderBy: { sentAt: 'desc' }, take: 1 } },
  });

  if (!lead) {
    return { claimed: false, alreadyHandledReason: 'Lead not found.' };
  }

  switch (lead.status) {
    case 'sent':
      return {
        claimed: false,
        alreadyHandledReason: lead.sends[0] ? `Already sent (via ${lead.sends[0].approvedVia}).` : 'Already sent.',
      };
    case 'rejected':
      return { claimed: false, alreadyHandledReason: 'Already rejected.' };
    case 'skipped':
      return { claimed: false, alreadyHandledReason: 'Already skipped.' };
    case 'queued':
      return { claimed: false, alreadyHandledReason: 'Someone else is processing this lead right now — try again in a moment.' };
    default:
      return { claimed: false, alreadyHandledReason: `This lead is no longer awaiting a decision (status: ${lead.status}).` };
  }
}

/** Reverts a claim back to `'drafted'` — used when the claim succeeded but the action it was
 * guarding didn't actually complete (e.g. the compliance chokepoint blocked the send), so the
 * draft stays available for a future attempt instead of getting stuck in `'queued'` forever.
 * The conditional `where` makes this safe to call even if something else already moved the lead
 * on (defensive, not expected to matter in practice). */
export async function releaseLeadClaim(leadId: string): Promise<void> {
  await prisma.lead.updateMany({ where: { id: leadId, status: 'queued' }, data: { status: 'drafted' } });
}
