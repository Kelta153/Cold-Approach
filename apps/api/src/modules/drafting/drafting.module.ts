import { Module } from '@nestjs/common';
import { DraftingService } from './drafting.service';

@Module({
  providers: [DraftingService],
  exports: [DraftingService],
})
export class DraftingModule {}
