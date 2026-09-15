import { Module } from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { TemplatesSchedulerJob } from './templates-scheduler.job';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogModule } from '../audit/audit-log.module';

@Module({
  imports: [NotificationsModule, AuditLogModule],
  controllers: [TemplatesController],
  providers: [TemplatesService, TemplatesSchedulerJob],
})
export class TemplatesModule {}
