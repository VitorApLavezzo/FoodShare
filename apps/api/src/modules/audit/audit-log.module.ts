import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { RetentionJob } from './retention.job';
import { AuditLogController } from './audit-log.controller';

@Module({
  controllers: [AuditLogController],
  providers: [AuditLogService, RetentionJob],
  exports: [AuditLogService],
})
export class AuditLogModule {}
