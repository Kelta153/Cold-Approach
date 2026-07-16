/** Minimal shape of the Telegram Bot API update payload we care about at this stage — just
 * enough to log it and resolve `telegramUserId` to a `User`. Not exhaustive; expand as Phase 4
 * wires real approve/reject/regenerate handling. */
export interface TelegramCallbackQuery {
  id: string;
  from: {
    id: number;
    username?: string;
    first_name?: string;
  };
  data?: string;
  message?: unknown;
}

export interface TelegramUpdate {
  update_id: number;
  callback_query?: TelegramCallbackQuery;
  [key: string]: unknown;
}
