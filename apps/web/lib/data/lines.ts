import { apiFetch } from '../api-client';
import type { LineFixture } from '../mock-data';

export type { LineFixture };

interface RawBusinessLine {
  id: string;
  name: string;
  senderName: string;
  companyLegalName: string;
  postalAddress: string | null;
  sendingDomain: string;
  sendingInboxes: unknown;
  channelsEnabled: unknown;
  sendLimits: unknown;
  warmupComplete: boolean;
}

const LINE_COLORS = ['#3fce8a', '#6ea8fe', '#c2508f', '#e8a33d'];

function mapLine(raw: RawBusinessLine, index: number): LineFixture {
  const inboxes = Array.isArray(raw.sendingInboxes) ? (raw.sendingInboxes as { email: string; active: boolean }[]) : [];
  const channels = (raw.channelsEnabled as { email?: boolean; instagram?: boolean } | null) ?? {};
  const limits = (raw.sendLimits as { perInboxPerDay?: number } | null) ?? {};

  return {
    id: raw.id,
    name: raw.name,
    color: LINE_COLORS[index % LINE_COLORS.length],
    senderName: raw.senderName,
    // Not a modeled schema column — the admin form still shows it as a read-only field, just
    // without a real backing value to display beyond the legal name.
    positioning: raw.companyLegalName,
    companyLegalName: raw.companyLegalName,
    postalAddress: raw.postalAddress,
    sendingDomain: raw.sendingDomain,
    inboxes: inboxes.map((ib) => ({ addr: ib.email, warmupStatus: ib.active ? 'warm' : 'warming' })),
    // Schema doesn't model unsubscribe copy as its own column (see docs/project.md) — shown as
    // a fixed compliance-standard placeholder rather than fabricating a persisted value.
    unsubscribeCopy: 'One-click unsubscribe link in every message.',
    dailyCapPerLine: limits.perInboxPerDay ?? 0,
    capPerInbox: limits.perInboxPerDay ?? 0,
    minGapSeconds: 90,
    warmupComplete: raw.warmupComplete,
    channelsEnabled: { email: channels.email ?? true, instagram: channels.instagram ?? false },
  };
}

export async function getLines(): Promise<LineFixture[]> {
  const raw = await apiFetch<RawBusinessLine[]>('/business-lines');
  return raw.map(mapLine);
}

export async function getLine(lineId: string): Promise<LineFixture | undefined> {
  return (await getLines()).find((l) => l.id === lineId);
}

/** Admin-only PATCH — see BusinessLinesController's `@Roles('admin')` gate on this route. Used
 * by the warm-up toggle and channel switches, which are real, persisted fields (not local-only
 * demo state — see schema.prisma `BusinessLine.warmupComplete`/`channelsEnabled`). Returns just
 * the two fields the callers need, rather than a full re-mapped `LineFixture` (which would need
 * a color-index it doesn't have in this context). */
export async function updateBusinessLine(
  lineId: string,
  patch: { warmupComplete?: boolean; channelsEnabled?: { email: boolean; instagram: boolean } },
): Promise<{ warmupComplete: boolean; channelsEnabled: { email: boolean; instagram: boolean } }> {
  const raw = await apiFetch<RawBusinessLine>(`/business-lines/${lineId}`, { method: 'PATCH', body: patch });
  const channels = (raw.channelsEnabled as { email?: boolean; instagram?: boolean } | null) ?? {};
  return { warmupComplete: raw.warmupComplete, channelsEnabled: { email: channels.email ?? true, instagram: channels.instagram ?? false } };
}
