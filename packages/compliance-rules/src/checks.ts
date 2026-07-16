import type { SendCheckContext } from '@outreach-engine/types';

// Each check is a pure, independently unit-testable function. Real DB logic lands in Phase 4 —
// today every check returns true so the aggregator/interfaces/tests can be proven correct now.

export async function checkEmailVerified(_ctx: SendCheckContext): Promise<boolean> {
  return true; // TODO Phase 4: look up Lead.emailStatus === 'valid'
}

export async function checkNotSuppressed(_ctx: SendCheckContext): Promise<boolean> {
  return true; // TODO Phase 4: check SuppressionEntry by email/domain/googlePlaceId/instagramHandle
}

export async function checkFooterPresent(_ctx: SendCheckContext): Promise<boolean> {
  return true; // TODO Phase 4: require BusinessLine.postalAddress and unsubscribe copy to be set
}

export async function checkWarmupComplete(_ctx: SendCheckContext): Promise<boolean> {
  return true; // TODO Phase 4: check BusinessLine.warmupComplete
}

export async function checkInboxCapNotExceeded(_ctx: SendCheckContext): Promise<boolean> {
  return true; // TODO Phase 4: count today's Sends for ctx.sendingInbox against BusinessLine.sendLimits
}
