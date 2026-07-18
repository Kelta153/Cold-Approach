import { Inject, Injectable, Logger } from '@nestjs/common';
import { Bot } from 'grammy';
import { prisma } from '@outreach-engine/db';
import { SendingService } from '../sending/sending.service';
import type { TelegramCallbackQuery, TelegramUpdate } from './telegram.types';

/**
 * The webhook route, secret verification, the telegramUserId → User.id mapping, and the
 * Approve → `attemptSend` wiring below are real. What's still missing (not built this pass):
 * the *outbound* side — nothing yet calls Telegram's `sendMessage` to actually present a draft
 * with Approve/Reject/Regenerate inline buttons in the first place, so `callback_query.data`'s
 * `"approve:<draftId>"` format is this service's own convention, not yet produced by a live
 * notification. Reject/Regenerate callbacks are logged but not wired — only Approve was in
 * scope for this pass.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot | null;

  constructor(@Inject(SendingService) private readonly sendingService: SendingService) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.bot = token ? new Bot(token) : null;
    if (!this.bot) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — TelegramService constructed without a live bot instance.');
    }
  }

  /** Verifies the shared secret Telegram sends back on every webhook request
   * (`X-Telegram-Bot-Api-Secret-Token`), configured via `TELEGRAM_WEBHOOK_SECRET`. */
  verifyWebhookSecret(secretFromHeader: string | undefined): boolean {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expected) {
      this.logger.warn('TELEGRAM_WEBHOOK_SECRET is not configured — rejecting all webhook requests.');
      return false;
    }
    return secretFromHeader === expected;
  }

  /** Maps a Telegram user id to our own audited `User.id` via `User.telegramUserId`. Returns
   * null if no user has linked this Telegram account. */
  async resolveUser(telegramUserId: number): Promise<{ id: string; role: string } | null> {
    const user = await prisma.user.findUnique({ where: { telegramUserId: String(telegramUserId) } });
    return user ? { id: user.id, role: user.role } : null;
  }

  /** Resolves the sending user for a callback_query and, on `"approve:<draftId>"`, calls the
   * exact same `SendingService.attemptSend(draftId, approvedByUserId, 'telegram')` path the
   * webapp's Send button calls with `'webapp'` — never a second write path to `Send`. Unlinked
   * Telegram accounts and non-approve actions are logged, not acted on. */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    this.logger.log(`Received Telegram update ${update.update_id}`);

    const callbackQuery: TelegramCallbackQuery | undefined = update.callback_query;
    if (!callbackQuery) {
      return;
    }

    const user = await this.resolveUser(callbackQuery.from.id);
    this.logger.log(
      `callback_query from telegramUserId=${callbackQuery.from.id} data=${callbackQuery.data ?? '<none>'} ` +
        `resolvedUser=${user ? user.id : '<unlinked>'}`,
    );

    if (!user) {
      this.logger.warn(`Ignoring callback from unlinked Telegram account ${callbackQuery.from.id} — no matching User.telegramUserId.`);
      return;
    }

    const [action, draftId] = (callbackQuery.data ?? '').split(':');
    if (action !== 'approve' || !draftId) {
      this.logger.log(`Callback action "${action}" is not wired to any send-affecting behavior yet.`);
      return;
    }

    const result = await this.sendingService.attemptSend(draftId, user.id, 'telegram');
    if (!result.allowed) {
      this.logger.warn(`Telegram approve for draft ${draftId} was blocked by the compliance chokepoint: ${result.blockedReasons.join('; ')}`);
    } else {
      this.logger.log(`Telegram approve for draft ${draftId} sent successfully (approvedByUserId=${user.id}).`);
    }
  }
}
