import type { SendCheckResult } from '@outreach-engine/types';
import { apiFetch } from '../api-client';

/** The webapp Send button — the same chokepoint-gated path the Telegram bot's Approve callback
 * will call with `approvedVia: 'telegram'`. `approvedByUserId` is never sent from here — apps/api
 * derives it from the real session, not a client-supplied value. */
export async function attemptSend(draftId: string, businessLineId: string): Promise<SendCheckResult> {
  return apiFetch<SendCheckResult>('/sending/attempt', {
    method: 'POST',
    businessLineId,
    body: { draftId, approvedVia: 'webapp' },
  });
}

export async function skipReviewLead(leadId: string, businessLineId: string): Promise<void> {
  await apiFetch(`/queue/review/${leadId}/skip`, { method: 'POST', businessLineId });
}

export async function rejectReviewLead(leadId: string, businessLineId: string): Promise<void> {
  await apiFetch(`/queue/review/${leadId}/reject`, { method: 'POST', businessLineId });
}

export async function skipDmLead(leadId: string, businessLineId: string): Promise<void> {
  await apiFetch(`/queue/dm/${leadId}/skip`, { method: 'POST', businessLineId });
}

export async function rejectDmLead(leadId: string, businessLineId: string): Promise<void> {
  await apiFetch(`/queue/dm/${leadId}/reject`, { method: 'POST', businessLineId });
}

export async function markDmSent(leadId: string, businessLineId: string): Promise<void> {
  await apiFetch(`/queue/dm/${leadId}/sent`, { method: 'POST', businessLineId });
}

export async function markReplyHandled(replyId: string, businessLineId: string): Promise<void> {
  await apiFetch(`/queue/replies/${replyId}/handled`, { method: 'POST', businessLineId });
}

export async function escalateReply(replyId: string, businessLineId: string): Promise<void> {
  await apiFetch(`/queue/replies/${replyId}/escalate`, { method: 'POST', businessLineId });
}

export async function skipReply(replyId: string, businessLineId: string): Promise<void> {
  await apiFetch(`/queue/replies/${replyId}/skip`, { method: 'POST', businessLineId });
}
