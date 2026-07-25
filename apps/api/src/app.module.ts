import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BusinessLineScopeModule } from './common/business-line-scope/business-line-scope.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { BusinessLinesModule } from './modules/business-lines/business-lines.module';
import { CatalogueModule } from './modules/catalogue/catalogue.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { DraftingModule } from './modules/drafting/drafting.module';
import { EnrichmentModule } from './modules/enrichment/enrichment.module';
import { InstagramModule } from './modules/instagram/instagram.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { QueueModule } from './modules/queue/queue.module';
import { RepliesModule } from './modules/replies/replies.module';
import { SendingModule } from './modules/sending/sending.module';
import { SuppressionModule } from './modules/suppression/suppression.module';
import { TargetingModule } from './modules/targeting/targeting.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BusinessLineScopeModule,
    QueuesModule,
    HealthModule,
    AuthModule,
    BusinessLinesModule,
    CatalogueModule,
    TargetingModule,
    TemplatesModule,
    DiscoveryModule,
    EnrichmentModule,
    DraftingModule,
    ComplianceModule,
    SendingModule,
    QueueModule,
    RepliesModule,
    InstagramModule,
    SuppressionModule,
    NotificationsModule,
  ],
})
export class AppModule {}
