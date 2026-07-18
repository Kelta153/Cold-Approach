import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const { checkEmailVerified, checkNotSuppressed, checkFooterPresent, checkWarmupComplete, checkInboxCapNotExceeded } = await import('./checks');

const CTX = { leadId: 'lead_1', businessLineId: 'line_1', sendingInbox: 'kay@auroraskin.co' };

beforeEach(() => {
  leadFindUniqueMock.mockReset();
  businessLineFindUniqueMock.mockReset();
  suppressionFindFirstMock.mockReset();
  sendCountMock.mockReset();
});

describe('checkWarmupComplete', () => {
  it('fails when the business line has not completed warm-up', async () => {
    businessLineFindUniqueMock.mockResolvedValue({ warmupComplete: false });
    expect(await checkWarmupComplete(CTX)).toBe(false);
  });

  it('passes once warmupComplete is true', async () => {
    businessLineFindUniqueMock.mockResolvedValue({ warmupComplete: true });
    expect(await checkWarmupComplete(CTX)).toBe(true);
  });
});

describe('checkFooterPresent', () => {
  it('fails when postalAddress is null', async () => {
    businessLineFindUniqueMock.mockResolvedValue({ postalAddress: null });
    expect(await checkFooterPresent(CTX)).toBe(false);
  });

  it('fails when postalAddress is an empty string', async () => {
    businessLineFindUniqueMock.mockResolvedValue({ postalAddress: '   ' });
    expect(await checkFooterPresent(CTX)).toBe(false);
  });

  it('passes when postalAddress is set', async () => {
    businessLineFindUniqueMock.mockResolvedValue({ postalAddress: '4 Paintworks, Bristol BS4 3EH' });
    expect(await checkFooterPresent(CTX)).toBe(true);
  });
});

describe('checkEmailVerified', () => {
  it('fails when the lead email is unverified', async () => {
    leadFindUniqueMock.mockResolvedValue({ emailStatus: 'unverified' });
    expect(await checkEmailVerified(CTX)).toBe(false);
  });

  it('passes when the lead email is valid', async () => {
    leadFindUniqueMock.mockResolvedValue({ emailStatus: 'valid' });
    expect(await checkEmailVerified(CTX)).toBe(true);
  });
});

describe('checkNotSuppressed', () => {
  it('fails when a matching suppression entry exists', async () => {
    leadFindUniqueMock.mockResolvedValue({ email: 'a@b.com', business: {} });
    suppressionFindFirstMock.mockResolvedValue({ id: 'sup_1' });
    expect(await checkNotSuppressed(CTX)).toBe(false);
  });

  it('passes when no suppression entry matches', async () => {
    leadFindUniqueMock.mockResolvedValue({ email: 'a@b.com', business: {} });
    suppressionFindFirstMock.mockResolvedValue(null);
    expect(await checkNotSuppressed(CTX)).toBe(true);
  });
});

describe('checkInboxCapNotExceeded', () => {
  it('fails once today’s send count reaches the configured per-inbox cap', async () => {
    businessLineFindUniqueMock.mockResolvedValue({ sendLimits: { perInboxPerDay: 5 } });
    sendCountMock.mockResolvedValue(5);
    expect(await checkInboxCapNotExceeded(CTX)).toBe(false);
  });

  it('passes when under the cap', async () => {
    businessLineFindUniqueMock.mockResolvedValue({ sendLimits: { perInboxPerDay: 5 } });
    sendCountMock.mockResolvedValue(2);
    expect(await checkInboxCapNotExceeded(CTX)).toBe(true);
  });
});
