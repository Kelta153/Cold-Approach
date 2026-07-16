import type { SendCheckContext, SendCheckResult } from '@outreach-engine/types';
import {
  checkEmailVerified,
  checkFooterPresent,
  checkInboxCapNotExceeded,
  checkNotSuppressed,
  checkWarmupComplete,
} from './checks';

export interface ChokepointCheck {
  reason: string;
  run: (ctx: SendCheckContext) => Promise<boolean>;
}

export const DEFAULT_CHECKS: ChokepointCheck[] = [
  { reason: 'Email is not verified.', run: checkEmailVerified },
  { reason: 'Lead is on the suppression list.', run: checkNotSuppressed },
  { reason: 'Compliance footer (postal address / unsubscribe copy) is missing for this business line.', run: checkFooterPresent },
  { reason: 'Sending inbox has not completed warm-up.', run: checkWarmupComplete },
  { reason: 'Sending inbox has reached its daily cap.', run: checkInboxCapNotExceeded },
];

/** The single enforced path before any Send row is written. Runs all five checks and
 * returns every failing reason — not just the first — so an operator sees everything
 * wrong with a send at once. `checks` defaults to the real five checks; tests override it
 * to simulate individual failures without mocking modules. */
export async function runComplianceChokepoint(ctx: SendCheckContext, checks: ChokepointCheck[] = DEFAULT_CHECKS): Promise<SendCheckResult> {
  const results = await Promise.all(checks.map(async (check) => ({ reason: check.reason, passed: await check.run(ctx) })));
  const blockedReasons = results.filter((r) => !r.passed).map((r) => r.reason);
  return { allowed: blockedReasons.length === 0, blockedReasons };
}
