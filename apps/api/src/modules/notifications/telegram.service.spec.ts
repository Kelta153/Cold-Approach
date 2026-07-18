import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendCheckResult } from '@outreach-engine/types';
import type { SendingService } from '../sending/sending.service';
import type { TelegramUpdate } from './telegram.types';

const userFindUniqueMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => userFindUniqueMock(...args) } },
}));

// vi.mock calls are hoisted above imports by vitest, so a plain static import (unlike
// packages/compliance-rules' dynamic-import pattern) is safe here and keeps this file valid
// CommonJS — apps/api's tsconfig has no "type": "module", so top-level `await import()` isn't
// allowed by `tsc` even though vitest itself would happily run it.
import { TelegramService } from './telegram.service';

function makeSendingService(result: SendCheckResult): SendingService {
  return { attemptSend: vi.fn().mockResolvedValue(result) } as unknown as SendingService;
}

const UPDATE = (data: string | undefined, telegramUserId = 12345): TelegramUpdate => ({
  update_id: 1,
  callback_query: { id: 'cbq_1', from: { id: telegramUserId }, data },
});

beforeEach(() => {
  userFindUniqueMock.mockReset();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});

describe('TelegramService.handleUpdate', () => {
  it('calls attemptSend with approvedVia=telegram on an approve callback from a linked user', async () => {
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    const sending = makeSendingService({ allowed: true, blockedReasons: [] });
    const service = new TelegramService(sending);

    await service.handleUpdate(UPDATE('approve:draft_42'));

    expect(sending.attemptSend).toHaveBeenCalledWith('draft_42', 'user_1', 'telegram');
  });

  it('never calls attemptSend for an unlinked Telegram account', async () => {
    userFindUniqueMock.mockResolvedValue(null);
    const sending = makeSendingService({ allowed: true, blockedReasons: [] });
    const service = new TelegramService(sending);

    await service.handleUpdate(UPDATE('approve:draft_42'));

    expect(sending.attemptSend).not.toHaveBeenCalled();
  });

  it('never calls attemptSend for a non-approve action', async () => {
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    const sending = makeSendingService({ allowed: true, blockedReasons: [] });
    const service = new TelegramService(sending);

    await service.handleUpdate(UPDATE('reject:draft_42'));

    expect(sending.attemptSend).not.toHaveBeenCalled();
  });

  it('does not throw when the chokepoint blocks the send — it just logs the block', async () => {
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    const sending = makeSendingService({ allowed: false, blockedReasons: ['Sending inbox has not completed warm-up.'] });
    const service = new TelegramService(sending);

    await expect(service.handleUpdate(UPDATE('approve:draft_42'))).resolves.toBeUndefined();
    expect(sending.attemptSend).toHaveBeenCalledWith('draft_42', 'user_1', 'telegram');
  });

  it('ignores updates with no callback_query', async () => {
    const sending = makeSendingService({ allowed: true, blockedReasons: [] });
    const service = new TelegramService(sending);

    await service.handleUpdate({ update_id: 2 });

    expect(sending.attemptSend).not.toHaveBeenCalled();
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe('TelegramService.verifyWebhookSecret', () => {
  it('rejects when TELEGRAM_WEBHOOK_SECRET is not configured', () => {
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }));
    expect(service.verifyWebhookSecret('anything')).toBe(false);
  });

  it('accepts only an exact match to the configured secret', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'shh-its-a-secret';
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }));
    expect(service.verifyWebhookSecret('shh-its-a-secret')).toBe(true);
    expect(service.verifyWebhookSecret('wrong')).toBe(false);
  });
});
