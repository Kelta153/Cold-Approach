import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendCheckResult } from '@outreach-engine/types';
import type { ComplianceService } from '../compliance/compliance.service';
import { SendingService } from './sending.service';

const findUniqueMock = vi.fn();
const sendCreateMock = vi.fn();
const leadUpdateMock = vi.fn();
const leadUpdateManyMock = vi.fn();
const leadFindUniqueMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: {
    draft: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
    send: { create: (...args: unknown[]) => sendCreateMock(...args) },
    lead: {
      update: (...args: unknown[]) => leadUpdateMock(...args),
      updateMany: (...args: unknown[]) => leadUpdateManyMock(...args),
      findUnique: (...args: unknown[]) => leadFindUniqueMock(...args),
    },
  },
}));

const DRAFT = {
  id: 'draft_1',
  leadId: 'lead_1',
  subject: 'Test subject',
  body: 'Test body',
  lead: {
    businessLineId: 'line_1',
    email: 'prospect@example.com',
    businessLine: {
      sendingInboxes: [{ email: 'kay@auroraskin.co', dailyCap: 40, active: true }],
    },
  },
};

function makeComplianceService(result: SendCheckResult): ComplianceService {
  return { runChokepoint: vi.fn().mockResolvedValue(result) } as unknown as ComplianceService;
}

describe('SendingService.attemptSend', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    sendCreateMock.mockReset();
    leadUpdateMock.mockReset();
    leadUpdateManyMock.mockReset();
    leadFindUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue(DRAFT);
    // Default: the atomic claim always succeeds (lead was in 'drafted') — individual tests below
    // override this to exercise the "someone else already handled it" path.
    leadUpdateManyMock.mockResolvedValue({ count: 1 });
    delete process.env.INSTANTLY_API_KEY;
  });

  it('blocks the whole send when the compliance chokepoint reports a single failing check, and surfaces the reason', async () => {
    const blockedResult: SendCheckResult = {
      allowed: false,
      blockedReasons: ['Sending inbox has not completed warm-up.'],
    };
    const sending = new SendingService(makeComplianceService(blockedResult));

    const result = await sending.attemptSend('draft_1', 'user_1', 'webapp');

    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain('Sending inbox has not completed warm-up.');
    // The reason must not be swallowed — it must be the exact same result object surfaced.
    expect(result).toEqual(blockedResult);
    // And, critically, nothing was written to the Send table.
    expect(sendCreateMock).not.toHaveBeenCalled();
  });

  it('returns every blocked reason, not just the first, when multiple checks fail', async () => {
    const blockedResult: SendCheckResult = {
      allowed: false,
      blockedReasons: ['Email is not verified.', 'Lead is on the suppression list.'],
    };
    const sending = new SendingService(makeComplianceService(blockedResult));

    const result = await sending.attemptSend('draft_1', 'user_1', 'webapp');

    expect(result.blockedReasons).toHaveLength(2);
    expect(sendCreateMock).not.toHaveBeenCalled();
  });

  it('writes exactly one Send row, recording approvedByUserId/approvedVia, when the chokepoint allows the send', async () => {
    const allowedResult: SendCheckResult = { allowed: true, blockedReasons: [] };
    const sending = new SendingService(makeComplianceService(allowedResult));

    const result = await sending.attemptSend('draft_1', 'user_42', 'telegram');

    expect(result.allowed).toBe(true);
    expect(sendCreateMock).toHaveBeenCalledTimes(1);
    expect(sendCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leadId: 'lead_1',
        draftId: 'draft_1',
        approvedByUserId: 'user_42',
        approvedVia: 'telegram',
      }),
    });
    expect(leadUpdateMock).toHaveBeenCalledWith({ where: { id: 'lead_1' }, data: { status: 'sent' } });
  });

  it('marks the Send row simulated when INSTANTLY_API_KEY is not configured', async () => {
    const allowedResult: SendCheckResult = { allowed: true, blockedReasons: [] };
    const sending = new SendingService(makeComplianceService(allowedResult));

    await sending.attemptSend('draft_1', 'user_42', 'webapp');

    expect(sendCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ simulated: true, providerMessageId: null }),
    });
  });

  it('never writes a Send row for a webapp-approved send that fails compliance either', async () => {
    const blockedResult: SendCheckResult = { allowed: false, blockedReasons: ['Sending inbox has reached its daily cap.'] };
    const sending = new SendingService(makeComplianceService(blockedResult));

    await sending.attemptSend('draft_1', 'user_1', 'webapp');

    expect(sendCreateMock).not.toHaveBeenCalled();
  });

  it('releases the claim (reverts the lead back to drafted) when the chokepoint blocks the send', async () => {
    const blockedResult: SendCheckResult = { allowed: false, blockedReasons: ['Sending inbox has not completed warm-up.'] };
    const sending = new SendingService(makeComplianceService(blockedResult));

    await sending.attemptSend('draft_1', 'user_1', 'webapp');

    expect(leadUpdateManyMock).toHaveBeenCalledWith({ where: { id: 'lead_1', status: 'drafted' }, data: { status: 'queued' } });
    expect(leadUpdateManyMock).toHaveBeenCalledWith({ where: { id: 'lead_1', status: 'queued' }, data: { status: 'drafted' } });
  });
});

describe('SendingService.attemptSend — concurrent-decision race', () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    sendCreateMock.mockReset();
    leadUpdateMock.mockReset();
    leadUpdateManyMock.mockReset();
    leadFindUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue(DRAFT);
    delete process.env.INSTANTLY_API_KEY;
  });

  it('blocks the send and never touches the compliance chokepoint when another decision already claimed the lead', async () => {
    leadUpdateManyMock.mockResolvedValue({ count: 0 });
    leadFindUniqueMock.mockResolvedValue({
      status: 'sent',
      sends: [{ approvedVia: 'telegram' }],
    });
    const compliance = makeComplianceService({ allowed: true, blockedReasons: [] });
    const sending = new SendingService(compliance);

    const result = await sending.attemptSend('draft_1', 'user_2', 'webapp');

    expect(result).toEqual({ allowed: false, blockedReasons: ['Already sent (via telegram).'] });
    expect(compliance.runChokepoint).not.toHaveBeenCalled();
    expect(sendCreateMock).not.toHaveBeenCalled();
  });
});
