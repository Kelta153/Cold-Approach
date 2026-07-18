import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEFAULT_CHECKS are now real, Prisma-backed checks (see checks.ts) — mock the DB the same way
// checks.test.ts and apps/api's own service specs do, rather than needing a live database here.
const leadFindUniqueMock = vi.fn();
const businessLineFindUniqueMock = vi.fn();
const suppressionFindFirstMock = vi.fn();
const sendCountMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: {
    lead: { findUnique: (...args: unknown[]) => leadFindUniqueMock(...args) },
    businessLine: { findUnique: (...args: unknown[]) => businessLineFindUniqueMock(...args) },
    suppressionEntry: { findFirst: (...args: unknown[]) => suppressionFindFirstMock(...args) },
    send: { count: (...args: unknown[]) => sendCountMock(...args) },
  },
}));

const { DEFAULT_CHECKS, runComplianceChokepoint } = await import('./chokepoint');
type ChokepointCheck = (typeof DEFAULT_CHECKS)[number];

const CTX = { leadId: 'lead_1', businessLineId: 'line_1', sendingInbox: 'kay@auroraskin.co' };

const passing = (reason: string): ChokepointCheck => ({ reason, run: async () => true });
const failing = (reason: string): ChokepointCheck => ({ reason, run: async () => false });

beforeEach(() => {
  leadFindUniqueMock.mockReset();
  businessLineFindUniqueMock.mockReset();
  suppressionFindFirstMock.mockReset();
  sendCountMock.mockReset();
});

describe('runComplianceChokepoint', () => {
  it('allows the send when all five real checks pass', async () => {
    leadFindUniqueMock.mockResolvedValue({ emailStatus: 'valid', email: 'a@b.com', business: {} });
    businessLineFindUniqueMock.mockResolvedValue({ postalAddress: 'Somewhere', warmupComplete: true, sendLimits: { perInboxPerDay: 40 } });
    suppressionFindFirstMock.mockResolvedValue(null);
    sendCountMock.mockResolvedValue(0);

    const result = await runComplianceChokepoint(CTX, DEFAULT_CHECKS);
    expect(result.allowed).toBe(true);
    expect(result.blockedReasons).toEqual([]);
  });

  it('blocks on the real warm-up check when warmupComplete is false', async () => {
    leadFindUniqueMock.mockResolvedValue({ emailStatus: 'valid', email: 'a@b.com', business: {} });
    businessLineFindUniqueMock.mockResolvedValue({ postalAddress: 'Somewhere', warmupComplete: false, sendLimits: { perInboxPerDay: 40 } });
    suppressionFindFirstMock.mockResolvedValue(null);
    sendCountMock.mockResolvedValue(0);

    const result = await runComplianceChokepoint(CTX, DEFAULT_CHECKS);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain('Sending inbox has not completed warm-up.');
  });

  it('blocks the whole send when a single check fails', async () => {
    const checks = [passing('a'), passing('b'), failing('warm-up not complete'), passing('d'), passing('e')];
    const result = await runComplianceChokepoint(CTX, checks);
    expect(result.allowed).toBe(false);
  });

  it('surfaces the failing reason rather than swallowing it', async () => {
    const checks = [passing('a'), failing('warm-up not complete'), passing('c')];
    const result = await runComplianceChokepoint(CTX, checks);
    expect(result.blockedReasons).toContain('warm-up not complete');
  });

  it('returns every failing reason, not just the first', async () => {
    const checks = [failing('reason A'), passing('b'), failing('reason C'), failing('reason D')];
    const result = await runComplianceChokepoint(CTX, checks);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toEqual(['reason A', 'reason C', 'reason D']);
  });
});
