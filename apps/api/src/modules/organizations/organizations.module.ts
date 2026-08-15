import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { DonorsController } from './donors.controller';
import { NgosController } from './ngos.controller';
import { AuditLogModule } from '../audit/audit-log.module';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [AuditLogModule, SyncModule],
  controllers: [DonorsController, NgosController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
