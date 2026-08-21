import { Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as notificações do usuário atual.' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.findMany(user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marca uma notificação como lida.' })
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma notificação.' })
  deleteOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.notificationsService.deleteOne(user.id, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Limpa todas as notificações do usuário atual.' })
  deleteAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.deleteAll(user.id);
  }
}
