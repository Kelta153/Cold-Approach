import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { HealthController } from './health.controller';

@Module({
  imports: [QueuesModule],
  controllers: [HealthController],
})
export class HealthModule {}
