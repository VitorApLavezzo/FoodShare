import { Module } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { ReservationsController } from './reservations.controller';
import { AuditLogModule } from '../audit/audit-log.module';
import { SyncModule } from '../sync/sync.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [AuditLogModule, SyncModule, ChatModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
