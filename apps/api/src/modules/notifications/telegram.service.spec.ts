import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendCheckResult } from '@outreach-engine/types';
import type { LeadActionResult } from '../../common/lead-actions';
import type { DraftingService } from '../drafting/drafting.service';
import type { SendingService } from '../sending/sending.service';
import type { TelegramUpdate } from './telegram.types';

const userFindUniqueMock = vi.fn();
const userFindManyMock = vi.fn();

vi.mock('@outreach-engine/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUniqueMock(...args),
      findMany: (...args: unknown[]) => userFindManyMock(...args),
    },
  },
}));

const performRejectMock = vi.fn();
const performRegenerateMock = vi.fn();

vi.mock('../../common/lead-actions', () => ({
  performReject: (...args: unknown[]) => performRejectMock(...args),
  performRegenerate: (...args: unknown[]) => performRegenerateMock(...args),
}));

const sendMessageMock = vi.fn();
const answerCallbackQueryMock = vi.fn();

// Mocked at the SDK boundary (same convention as packages/llm-provider's groq/haiku tests) — a
// real `Bot` would try to hit Telegram's API the moment `.api.*` is called.
vi.mock('grammy', () => ({
  Bot: class {
    api = { sendMessage: (...args: unknown[]) => sendMessageMock(...args), answerCallbackQuery: (...args: unknown[]) => answerCallbackQueryMock(...args) };
    constructor(_token: string) {}
  },
  InlineKeyboard: class {
    text() {
      return this;
    }
    row() {
      return this;
    }
  },
}));

// vi.mock calls are hoisted above imports by vitest, so a plain static import (unlike
// packages/compliance-rules' dynamic-import pattern) is safe here and keeps this file valid
// CommonJS — apps/api's tsconfig has no "type": "module", so top-level `await import()` isn't
// allowed by `tsc` even though vitest itself would happily run it.
import { TelegramService } from './telegram.service';

function makeSendingService(result: SendCheckResult): SendingService {
  return { attemptSend: vi.fn().mockResolvedValue(result) } as unknown as SendingService;
}

function makeDraftingService(): DraftingService {
  return {} as DraftingService;
}

const UPDATE = (data: string | undefined, telegramUserId = 12345): TelegramUpdate => ({
  update_id: 1,
  callback_query: { id: 'cbq_1', from: { id: telegramUserId }, data },
});

beforeEach(() => {
  userFindUniqueMock.mockReset();
  userFindManyMock.mockReset();
  performRejectMock.mockReset();
  performRegenerateMock.mockReset();
  sendMessageMock.mockReset();
  answerCallbackQueryMock.mockReset();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});

describe('TelegramService.handleUpdate — approve', () => {
  it('calls attemptSend with approvedVia=telegram on an approve callback from a linked user', async () => {
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    const sending = makeSendingService({ allowed: true, blockedReasons: [] });
    const service = new TelegramService(sending, makeDraftingService());

    await service.handleUpdate(UPDATE('approve:draft_42'));

    expect(sending.attemptSend).toHaveBeenCalledWith('draft_42', 'user_1', 'telegram');
  });

  it('never calls attemptSend for an unlinked Telegram account', async () => {
    userFindUniqueMock.mockResolvedValue(null);
    const sending = makeSendingService({ allowed: true, blockedReasons: [] });
    const service = new TelegramService(sending, makeDraftingService());

    await service.handleUpdate(UPDATE('approve:draft_42'));

    expect(sending.attemptSend).not.toHaveBeenCalled();
  });

  it('does not throw when the chokepoint blocks the send — it just logs the block', async () => {
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    const sending = makeSendingService({ allowed: false, blockedReasons: ['Sending inbox has not completed warm-up.'] });
    const service = new TelegramService(sending, makeDraftingService());

    await expect(service.handleUpdate(UPDATE('approve:draft_42'))).resolves.toBeUndefined();
    expect(sending.attemptSend).toHaveBeenCalledWith('draft_42', 'user_1', 'telegram');
  });

  it('ignores updates with no callback_query', async () => {
    const sending = makeSendingService({ allowed: true, blockedReasons: [] });
    const service = new TelegramService(sending, makeDraftingService());

    await service.handleUpdate({ update_id: 2 });

    expect(sending.attemptSend).not.toHaveBeenCalled();
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });
});

describe('TelegramService.handleUpdate — reject/regenerate', () => {
  it('calls performReject with the leadId (not draftId) on a reject callback', async () => {
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    performRejectMock.mockResolvedValue({ ok: true } satisfies LeadActionResult);
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), makeDraftingService());

    await service.handleUpdate(UPDATE('reject:lead_7'));

    expect(performRejectMock).toHaveBeenCalledWith('lead_7');
  });

  it('calls performRegenerate with the leadId and the injected DraftingService on a regenerate callback', async () => {
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    performRegenerateMock.mockResolvedValue({ ok: true, draftId: 'draft_99' });
    const drafting = makeDraftingService();
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), drafting);

    await service.handleUpdate(UPDATE('regenerate:lead_7'));

    expect(performRegenerateMock).toHaveBeenCalledWith('lead_7', drafting);
  });

  it('never calls performReject/performRegenerate for an unlinked Telegram account', async () => {
    userFindUniqueMock.mockResolvedValue(null);
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), makeDraftingService());

    await service.handleUpdate(UPDATE('reject:lead_7'));

    expect(performRejectMock).not.toHaveBeenCalled();
  });
});

describe('TelegramService — answers every callback_query so the button visibly resolves', () => {
  it('answers with a blocked reason when approve is blocked by the compliance chokepoint', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    const sending = makeSendingService({ allowed: false, blockedReasons: ['Sending inbox has not completed warm-up.'] });
    const service = new TelegramService(sending, makeDraftingService());

    await service.handleUpdate(UPDATE('approve:draft_42'));

    expect(answerCallbackQueryMock).toHaveBeenCalledWith('cbq_1', { text: 'Blocked: Sending inbox has not completed warm-up.' });
  });

  it('answers with the already-handled reason when reject loses the atomic claim race', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    userFindUniqueMock.mockResolvedValue({ id: 'user_1', role: 'admin' });
    performRejectMock.mockResolvedValue({ ok: false, reason: 'Already sent (via webapp).' } satisfies LeadActionResult);
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), makeDraftingService());

    await service.handleUpdate(UPDATE('reject:lead_7'));

    expect(answerCallbackQueryMock).toHaveBeenCalledWith('cbq_1', { text: 'Already sent (via webapp).' });
  });
});

describe('TelegramService.notifyDraftReady', () => {
  const NOTIFICATION = { draftId: 'draft_1', leadId: 'lead_1', company: 'Acme Co', subject: 'Hi', body: 'Body text' };

  it('does nothing when TELEGRAM_BOT_TOKEN is not set — never queries for recipients', async () => {
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), makeDraftingService());

    await service.notifyDraftReady(NOTIFICATION);

    expect(userFindManyMock).not.toHaveBeenCalled();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('sends to every admin/operator with a linked telegramUserId', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    userFindManyMock.mockResolvedValue([
      { email: 'admin@x.com', telegramUserId: '111' },
      { email: 'operator@x.com', telegramUserId: '222' },
    ]);
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), makeDraftingService());

    await service.notifyDraftReady(NOTIFICATION);

    expect(userFindManyMock).toHaveBeenCalledWith({ where: { role: { in: ['admin', 'operator'] }, telegramUserId: { not: null } } });
    expect(sendMessageMock).toHaveBeenCalledTimes(2);
    expect(sendMessageMock).toHaveBeenCalledWith('111', expect.stringContaining('Acme Co'), expect.anything());
    expect(sendMessageMock).toHaveBeenCalledWith('222', expect.stringContaining('Acme Co'), expect.anything());
  });

  it('keeps notifying the remaining recipients when one send fails', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'fake-token';
    userFindManyMock.mockResolvedValue([
      { email: 'broken@x.com', telegramUserId: '111' },
      { email: 'fine@x.com', telegramUserId: '222' },
    ]);
    sendMessageMock.mockRejectedValueOnce(new Error('Bad Request: chat not found')).mockResolvedValueOnce({ message_id: 1 });
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), makeDraftingService());

    await expect(service.notifyDraftReady(NOTIFICATION)).resolves.toBeUndefined();

    expect(sendMessageMock).toHaveBeenCalledTimes(2);
  });
});

describe('TelegramService.verifyWebhookSecret', () => {
  it('rejects when TELEGRAM_WEBHOOK_SECRET is not configured', () => {
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), makeDraftingService());
    expect(service.verifyWebhookSecret('anything')).toBe(false);
  });

  it('accepts only an exact match to the configured secret', () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'shh-its-a-secret';
    const service = new TelegramService(makeSendingService({ allowed: true, blockedReasons: [] }), makeDraftingService());
    expect(service.verifyWebhookSecret('shh-its-a-secret')).toBe(true);
    expect(service.verifyWebhookSecret('wrong')).toBe(false);
  });
});
