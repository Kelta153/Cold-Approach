import { Inject, Injectable, Logger } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';
import { prisma } from '@outreach-engine/db';
import { performReject, performRegenerate } from '../../common/lead-actions';
import { DraftingService } from '../drafting/drafting.service';
import { SendingService } from '../sending/sending.service';
import type { TelegramCallbackQuery, TelegramUpdate } from './telegram.types';

export interface DraftReadyNotification {
  draftId: string;
  leadId: string;
  company: string;
  subject: string;
  body: string;
}

const BODY_PREVIEW_CHARS = 300;

/**
 * The webhook route, secret verification, the telegramUserId → User.id mapping, and outbound
 * notifications are all real. `notifyDraftReady` (called from `DraftingProcessor` once a draft is
 * written) broadcasts to every admin/operator with a linked `telegramUserId` — there's no
 * per-business-line routing (doesn't exist as a concept yet; see docs/project.md), and at this
 * pipeline's actual volume (roughly once/day, ~10 targets) broadcasting costs nothing.
 *
 * Approve/Reject/Regenerate all funnel through the exact same enforcement the webapp uses:
 * `SendingService.attemptSend` for approve, `performReject`/`performRegenerate`
 * (`common/lead-actions.ts`) for the other two — all three go through `claimLeadForDecision`'s
 * atomic guard, so a webapp action and a Telegram action racing on the same draft can't both win.
 *
 * Callback data carries a *draftId* for approve (`Send` is keyed on the draft) but a *leadId* for
 * reject/regenerate (both act on the lead as a whole, matching the webapp's own
 * `/queue/review/:leadId/...` routes) — not an inconsistency, just what each operation is actually
 * keyed on.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot | null;

  constructor(
    @Inject(SendingService) private readonly sendingService: SendingService,
    @Inject(DraftingService) private readonly draftingService: DraftingService,
  ) {
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

  /** Sends a real message with Approve/Reject/Regenerate buttons to every admin/operator with a
   * linked Telegram account. Best-effort per recipient — one failed send (e.g. a stale/blocked
   * chat, same failure mode diagnosed live this session) doesn't stop the others from being
   * notified. */
  async notifyDraftReady(input: DraftReadyNotification): Promise<void> {
    if (!this.bot) {
      this.logger.warn(`No live bot instance (TELEGRAM_BOT_TOKEN not set) — skipping notification for draft ${input.draftId}.`);
      return;
    }

    const recipients = await prisma.user.findMany({
      where: { role: { in: ['admin', 'operator'] }, telegramUserId: { not: null } },
    });

    if (recipients.length === 0) {
      this.logger.warn(`Draft ${input.draftId} is ready, but no admin/operator has a linked telegramUserId — nobody to notify.`);
      return;
    }

    const keyboard = new InlineKeyboard()
      .text('✅ Approve', `approve:${input.draftId}`)
      .text('❌ Reject', `reject:${input.leadId}`)
      .row()
      .text('🔄 Regenerate', `regenerate:${input.leadId}`);

    const preview = input.body.length > BODY_PREVIEW_CHARS ? `${input.body.slice(0, BODY_PREVIEW_CHARS)}…` : input.body;
    const text = `New draft ready for review\n\n${input.company}\n${input.subject}\n\n${preview}`;

    for (const recipient of recipients) {
      try {
        await this.bot.api.sendMessage(recipient.telegramUserId!, text, { reply_markup: keyboard });
      } catch (err) {
        this.logger.error(
          `Failed to notify ${recipient.email} (telegramUserId=${recipient.telegramUserId}) about draft ${input.draftId}: ${(err as Error).message}`,
        );
      }
    }
  }

  /** Resolves the acting user for a callback_query and dispatches Approve/Reject/Regenerate.
   * Unlinked Telegram accounts and unrecognized actions are logged, not acted on. Every branch
   * calls `answerCallbackQuery` so the button visibly resolves in Telegram instead of spinning
   * (or eventually erroring) — this was never wired before, even for the original Approve-only
   * path. */
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
      await this.answerCallback(callbackQuery.id, 'Your Telegram account is not linked to a user on this system.');
      return;
    }

    const [action, targetId] = (callbackQuery.data ?? '').split(':');

    if (action === 'approve' && targetId) {
      const result = await this.sendingService.attemptSend(targetId, user.id, 'telegram');
      if (!result.allowed) {
        this.logger.warn(`Telegram approve for draft ${targetId} was blocked by the compliance chokepoint: ${result.blockedReasons.join('; ')}`);
        await this.answerCallback(callbackQuery.id, `Blocked: ${result.blockedReasons[0] ?? 'compliance check failed'}`);
      } else {
        this.logger.log(`Telegram approve for draft ${targetId} sent successfully (approvedByUserId=${user.id}).`);
        await this.answerCallback(callbackQuery.id, '✅ Sent');
      }
      return;
    }

    if (action === 'reject' && targetId) {
      const result = await performReject(targetId);
      if (!result.ok) {
        this.logger.warn(`Telegram reject for lead ${targetId} did not go through: ${result.reason}`);
        await this.answerCallback(callbackQuery.id, result.reason);
      } else {
        this.logger.log(`Telegram reject for lead ${targetId} completed (by ${user.id}).`);
        await this.answerCallback(callbackQuery.id, '❌ Rejected');
      }
      return;
    }

    if (action === 'regenerate' && targetId) {
      const result = await performRegenerate(targetId, this.draftingService);
      if (!result.ok) {
        this.logger.warn(`Telegram regenerate for lead ${targetId} did not go through: ${result.reason}`);
        await this.answerCallback(callbackQuery.id, result.reason);
      } else {
        this.logger.log(`Telegram regenerate for lead ${targetId} completed (by ${user.id}), new draft ${result.draftId}.`);
        await this.answerCallback(callbackQuery.id, '🔄 New draft ready — check the app.');
      }
      return;
    }

    this.logger.log(`Callback action "${action}" is not recognized.`);
  }

  private async answerCallback(callbackQueryId: string, text: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.api.answerCallbackQuery(callbackQueryId, { text });
    } catch (err) {
      this.logger.warn(`Failed to answer callback query ${callbackQueryId}: ${(err as Error).message}`);
    }
  }
}
