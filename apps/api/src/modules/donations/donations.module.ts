import { Module } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { DonationsController } from './donations.controller';
import { DonationsExpirationJob } from './donations-expiration.job';
import { AuditLogModule } from '../audit/audit-log.module';
import { SyncModule } from '../sync/sync.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditLogModule, SyncModule, NotificationsModule],
  controllers: [DonationsController],
  providers: [DonationsService, DonationsExpirationJob],
  exports: [DonationsService],
})
export class DonationsModule {}
