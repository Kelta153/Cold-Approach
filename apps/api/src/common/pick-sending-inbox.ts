interface SendingInboxConfig {
  email: string;
  dailyCap: number;
  active: boolean;
}

/** Shared by sending.service.ts (attempting a real send) and the queue read endpoints (showing
 * what the chokepoint would decide) — both need the same "which inbox would this go out from"
 * resolution so a queue item's displayed blockedReasons matches what attemptSend would enforce. */
export function pickSendingInbox(sendingInboxes: unknown): string {
  const inboxes = Array.isArray(sendingInboxes) ? (sendingInboxes as SendingInboxConfig[]) : [];
  const active = inboxes.find((inbox) => inbox?.active);
  return active?.email ?? inboxes[0]?.email ?? '';
}
