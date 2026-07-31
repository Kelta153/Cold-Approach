import { prisma } from '@outreach-engine/db';
import { claimLeadForDecision, releaseLeadClaim } from './claim-lead';
import { loadDraftGroundingInput } from '../modules/drafting/load-draft-input';
import type { DraftingService } from '../modules/drafting/drafting.service';

export type LeadActionResult = { ok: true } | { ok: false; reason: string };

/**
 * Business-line-independent core of Reject/Regenerate — derives everything from the lead's own
 * row rather than a request-scoped `BusinessLineContext`. These are called from two places with
 * very different scoping needs: `QueueService` (webapp, has a real `X-Business-Line-Id` header
 * and layers its own tenant-isolation check via `assertLeadInScope` before calling these) and
 * `TelegramService` (a webhook callback, which has no such header — there's no ambiguity to
 * protect against there, since the specific `leadId`/`draftId` in the callback data already fully
 * determines scope). Keeping the actual write logic here once means both callers share it instead
 * of drifting apart.
 */
export async function performReject(leadId: string): Promise<LeadActionResult> {
  const claim = await claimLeadForDecision(leadId);
  if (!claim.claimed) {
    return { ok: false, reason: claim.alreadyHandledReason! };
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { business: true } });
  if (!lead) {
    await releaseLeadClaim(leadId);
    return { ok: false, reason: 'Lead not found.' };
  }

  await prisma.$transaction([
    prisma.lead.update({ where: { id: leadId }, data: { status: 'rejected' } }),
    prisma.suppressionEntry.create({
      data: {
        businessLineId: lead.businessLineId,
        email: lead.email ?? undefined,
        domain: lead.email?.split('@')[1] ?? undefined,
        googlePlaceId: lead.business.googlePlaceId ?? undefined,
        instagramHandle: lead.business.instagramHandle ?? undefined,
        reason: 'manual_reject',
      },
    }),
  ]);

  return { ok: true };
}

export async function performRegenerate(
  leadId: string,
  draftingService: DraftingService,
): Promise<LeadActionResult & { draftId?: string }> {
  const claim = await claimLeadForDecision(leadId);
  if (!claim.claimed) {
    return { ok: false, reason: claim.alreadyHandledReason! };
  }

  try {
    const latest = await prisma.draft.findFirst({ where: { leadId }, orderBy: { version: 'desc' } });
    const input = await loadDraftGroundingInput(leadId);
    const draft = await draftingService.draftEmail(input);

    const created = await prisma.draft.create({
      data: {
        leadId,
        subject: draft.subject,
        body: draft.body,
        groundingFacts: draft.groundingFacts,
        openPlaceholders: draft.openPlaceholders,
        model: draft.model,
        version: (latest?.version ?? 0) + 1,
      },
    });

    await releaseLeadClaim(leadId);
    return { ok: true, draftId: created.id };
  } catch (err) {
    await releaseLeadClaim(leadId);
    throw err;
  }
}
