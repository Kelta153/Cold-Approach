/** The compliance chokepoint contract — packages/compliance-rules implements this,
 * apps/api's sending module is the only caller. */
export interface SendCheckContext {
  leadId: string;
  businessLineId: string;
  sendingInbox: string;
}

export interface SendCheckResult {
  allowed: boolean;
  /** Every failing reason, not just the first — an operator needs to see everything wrong at once. */
  blockedReasons: string[];
}
