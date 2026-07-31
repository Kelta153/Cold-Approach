import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { DraftingModule } from '../drafting/drafting.module';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

@Module({
  imports: [ComplianceModule, DraftingModule],
  controllers: [QueueController],
  providers: [QueueService],
})
export class QueueModule {}
