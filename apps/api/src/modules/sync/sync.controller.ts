import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { SyncService } from './sync.service';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('sync')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  @ApiOperation({ summary: 'Status geral de sincronização entre nós (admin).' })
  getStatus() {
    return this.syncService.getStatus();
  }

  @Get('events')
  @ApiOperation({ summary: 'Eventos de sincronização recentes (admin).' })
  getEvents() {
    return this.syncService.findRecentEvents();
  }
}
