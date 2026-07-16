import { Module } from '@nestjs/common';
import { TargetingController } from './targeting.controller';
import { TargetingService } from './targeting.service';

@Module({
  controllers: [TargetingController],
  providers: [TargetingService],
  exports: [TargetingService],
})
export class TargetingModule {}
