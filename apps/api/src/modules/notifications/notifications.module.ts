import { Module } from '@nestjs/common';
import { DraftingModule } from '../drafting/drafting.module';
import { SendingModule } from '../sending/sending.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [SendingModule, DraftingModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class NotificationsModule {}
