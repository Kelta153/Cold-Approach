import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateManyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: {
    lead: {
      updateMany: (...args: unknown[]) => updateManyMock(...args),
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { claimLeadForDecision, releaseLeadClaim } from './claim-lead';

describe('claimLeadForDecision', () => {
  beforeEach(() => {
    updateManyMock.mockReset();
    findUniqueMock.mockReset();
  });

  it('succeeds when the lead is still drafted, via a conditional update (not a plain one)', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    const claim = await claimLeadForDecision('lead_1');

    expect(claim).toEqual({ claimed: true });
    expect(updateManyMock).toHaveBeenCalledWith({ where: { id: 'lead_1', status: 'drafted' }, data: { status: 'queued' } });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('reports who already sent it when the claim loses to a completed send', async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    findUniqueMock.mockResolvedValue({ status: 'sent', sends: [{ approvedVia: 'webapp' }] });

    const claim = await claimLeadForDecision('lead_1');

    expect(claim).toEqual({ claimed: false, alreadyHandledReason: 'Already sent (via webapp).' });
  });

  it('reports already-rejected when the claim loses to a rejection', async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    findUniqueMock.mockResolvedValue({ status: 'rejected', sends: [] });

    const claim = await claimLeadForDecision('lead_1');

    expect(claim).toEqual({ claimed: false, alreadyHandledReason: 'Already rejected.' });
  });

  it('reports a concurrent in-flight claim distinctly from an already-completed decision', async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    findUniqueMock.mockResolvedValue({ status: 'queued', sends: [] });

    const claim = await claimLeadForDecision('lead_1');

    expect(claim.claimed).toBe(false);
    expect(claim.alreadyHandledReason).toMatch(/try again in a moment/);
  });
});

describe('releaseLeadClaim', () => {
  it('reverts a queued lead back to drafted, conditionally', async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    await releaseLeadClaim('lead_1');

    expect(updateManyMock).toHaveBeenCalledWith({ where: { id: 'lead_1', status: 'queued' }, data: { status: 'drafted' } });
  });
});
