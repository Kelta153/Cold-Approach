import { Module } from '@nestjs/common';
import { SendingModule } from '../sending/sending.module';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [SendingModule],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class NotificationsModule {}
