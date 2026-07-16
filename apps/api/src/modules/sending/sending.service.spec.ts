import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendCheckResult } from '@outreach-engine/types';
import type { ComplianceService } from '../compliance/compliance.service';
import { SendingService } from './sending.service';

const findUniqueMock = vi.fn();
const sendCreateMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: {
    draft: { findUnique: (...args: unknown[]) => findUniqueMock(...args) },
    send: { create: (...args: unknown[]) => sendCreateMock(...args) },
  },
}));

const DRAFT = {
  id: 'draft_1',
  leadId: 'lead_1',
  lead: {
    businessLineId: 'line_1',
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
    findUniqueMock.mockResolvedValue(DRAFT);
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
  });

  it('never writes a Send row for a webapp-approved send that fails compliance either', async () => {
    const blockedResult: SendCheckResult = { allowed: false, blockedReasons: ['Sending inbox has reached its daily cap.'] };
    const sending = new SendingService(makeComplianceService(blockedResult));

    await sending.attemptSend('draft_1', 'user_1', 'webapp');

    expect(sendCreateMock).not.toHaveBeenCalled();
  });
});
