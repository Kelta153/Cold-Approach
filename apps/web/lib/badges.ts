import type { CSSProperties } from 'react';
import type { ApprovedVia, ReplyClassification } from '@outreach-engine/types';

export interface BadgeSpec {
  label: string;
  /** color+'22' background, color+'44' border, per the handoff's badge formula. */
  style: CSSProperties;
}

export function badge(color: string, label: string): BadgeSpec {
  return {
    label,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 10.5,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      background: color + '22',
      color,
      border: `1px solid ${color}44`,
    },
  };
}

export type DoneStatus = 'sent' | 'skipped' | 'rejected' | 'escalated' | 'handled';

const DONE_COLOR: Record<DoneStatus, string> = {
  sent: '#6ea8fe',
  skipped: '#8a90a1',
  rejected: '#f0637a',
  escalated: '#e8a33d',
  handled: '#3fce8a',
};

const DONE_LABEL: Record<DoneStatus, string> = {
  sent: 'sent',
  skipped: 'skipped',
  rejected: 'suppressed',
  escalated: 'escalated',
  handled: 'handled',
};

/** `approvedVia` only matters for a 'sent' decision — Telegram-approved items get a distinct
 * "sent · Telegram" badge so operators can tell a bot approval from a webapp one at a glance.
 * `simulated` (no INSTANTLY_API_KEY configured) must stay visibly distinct from a real send too —
 * never silently indistinguishable, per the compliance-first tone of every other status here. */
export function doneBadge(status: DoneStatus, approvedVia?: ApprovedVia, simulated?: boolean): BadgeSpec {
  const color = simulated && status === 'sent' ? '#e8a33d' : DONE_COLOR[status] ?? '#8a90a1';
  const viaSuffix = status === 'sent' && approvedVia === 'telegram' ? ' · Telegram' : '';
  const simulatedSuffix = simulated && status === 'sent' ? ' · simulated' : '';
  const label = status === 'sent' ? `sent${viaSuffix}${simulatedSuffix}` : DONE_LABEL[status] ?? status;
  return badge(color, label);
}

const CLASSIFICATION_COLOR: Record<ReplyClassification, string> = {
  interested: '#3fce8a',
  question: '#6ea8fe',
  not_interested: '#8a90a1',
  opt_out: '#f0637a',
  auto_reply: '#8a90a1',
  complaint: '#f0637a',
  other: '#8a90a1',
};

const CLASSIFICATION_LABEL: Record<ReplyClassification, string> = {
  interested: 'interested',
  question: 'question',
  not_interested: 'not now',
  opt_out: 'opt out',
  auto_reply: 'auto-reply',
  complaint: 'complaint',
  other: 'other',
};

export function classificationBadge(cls: ReplyClassification): BadgeSpec {
  return badge(CLASSIFICATION_COLOR[cls] ?? '#8a90a1', CLASSIFICATION_LABEL[cls] ?? cls);
}

export function complianceBadge(blockedReasons: string[]): BadgeSpec {
  return blockedReasons.length > 0 ? badge('#e8a33d', 'blocked · compliance') : badge('#3fce8a', 'ready');
}

export function emailStatusBadge(status: string): BadgeSpec {
  return status === 'valid' ? badge('#3fce8a', 'email verified') : badge('#e8a33d', 'verification pending');
}

const STATUS_COLOR: Record<string, string> = {
  active: '#3fce8a',
  paused: '#e8a33d',
  complete: '#3fce8a',
  discovering: '#8a90a1',
  enriching: '#e8a33d',
  drafting: '#6ea8fe',
  failed: '#f0637a',
};

export function statusBadge(status: string): BadgeSpec {
  return badge(STATUS_COLOR[status] ?? '#8a90a1', status);
}
