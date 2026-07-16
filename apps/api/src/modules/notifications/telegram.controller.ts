import { Body, Controller, ForbiddenException, Headers, HttpCode, Post } from '@nestjs/common';
import type { TelegramUpdate } from './telegram.types';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secretHeader: string | undefined,
    @Body() update: TelegramUpdate,
  ) {
    if (!this.telegramService.verifyWebhookSecret(secretHeader)) {
      throw new ForbiddenException('Invalid Telegram webhook secret.');
    }
    await this.telegramService.handleUpdate(update);
    return { ok: true };
  }
}
