import { Module } from '@nestjs/common';
import { DonationsService } from './donations.service';
import { DonationsController } from './donations.controller';
import { DonationsExpirationJob } from './donations-expiration.job';
import { ReservationsModule } from '../reservations/reservations.module';
import { AuditLogModule } from '../audit/audit-log.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [ReservationsModule, AuditLogModule, SyncModule],
  controllers: [DonationsController],
  providers: [DonationsService, DonationsExpirationJob],
  exports: [DonationsService],
})
export class DonationsModule {}
