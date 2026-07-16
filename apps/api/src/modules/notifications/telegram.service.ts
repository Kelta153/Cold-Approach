import { Injectable, Logger } from '@nestjs/common';
import { Bot } from 'grammy';
import { prisma } from '@outreach-engine/db';
import type { TelegramCallbackQuery, TelegramUpdate } from './telegram.types';

/**
 * Scaffold only — see §7 of the spec. The webhook route, secret verification, and the
 * telegramUserId → User.id mapping exist now; real approve/reject/regenerate wiring is Phase 4.
 *
 * Phase 4 note: the Approve callback handler will call
 * `SendingService.attemptSend(draftId, approvedByUserId, 'telegram')` — the exact same
 * chokepoint-gated path the webapp's Approve button calls with `'webapp'`. It must never write
 * to the `Send` table itself or bypass `runComplianceChokepoint`.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot | null;

  constructor() {
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

  /** Logs the update and resolves the sending user for a callback_query. Does not call
   * `attemptSend` or take any send-related action — that is explicitly out of scope until
   * Phase 4 wires the Approve/Reject/Regenerate buttons. */
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
  }
}
