import { forwardRef, Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { DonorsController } from './donors.controller';
import { NgosController } from './ngos.controller';
import { AuditLogModule } from '../audit/audit-log.module';
import { SyncModule } from '../sync/sync.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [AuditLogModule, SyncModule, forwardRef(() => RealtimeModule)],
  controllers: [DonorsController, NgosController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
