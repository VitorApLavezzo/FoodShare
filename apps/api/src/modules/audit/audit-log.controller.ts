import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuditLogService } from './audit-log.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

@ApiTags('audit-logs')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @ApiOperation({ summary: 'Lista eventos de auditoria (admin). Filtrável por entidade.' })
  findAll(@Query() query: ListAuditLogsDto) {
    return this.auditLogService.findMany(query);
  }
}
