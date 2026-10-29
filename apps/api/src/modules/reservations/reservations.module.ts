import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsExpirationJob } from './reservations-expiration.job';
import { AuditLogModule } from '../audit/audit-log.module';
import { SyncModule } from '../sync/sync.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditLogModule, SyncModule, ChatModule, NotificationsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService, ReservationsExpirationJob],
  exports: [ReservationsService],
})
export class ReservationsModule {}
