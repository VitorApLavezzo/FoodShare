import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminUsersService } from './admin-users.service';
import { QueryUsersDto, UpdateUserStatusDto } from './dto/admin-users.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários da plataforma, com busca por nome/e-mail.' })
  findAll(@Query() query: QueryUsersDto) {
    return this.adminUsersService.findMany(query);
  }

  /**
   * O campo isActive era consultado no login e nunca escrito por lugar nenhum:
   * na prática não existia forma de tirar do ar quem estivesse abusando da
   * plataforma.
   */
  @Patch(':id/status')
  @ApiOperation({ summary: 'Bloqueia ou desbloqueia o acesso de um usuário.' })
  updateStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminUsersService.updateStatus(admin, id, dto);
  }
}
