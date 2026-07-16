import { Module } from '@nestjs/common';
import { ComplianceModule } from '../compliance/compliance.module';
import { SendingController } from './sending.controller';
import { SendingService } from './sending.service';

@Module({
  imports: [ComplianceModule],
  controllers: [SendingController],
  providers: [SendingService],
  exports: [SendingService],
})
export class SendingModule {}
