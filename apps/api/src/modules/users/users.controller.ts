import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PrivacyService } from './privacy.service';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly privacyService: PrivacyService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna o perfil do usuário autenticado.' })
  async me(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.usersService.findById(currentUser.id);
    return user ? this.usersService.sanitize(user) : null;
  }

  @Patch('me')
  @ApiOperation({ summary: 'Atualiza o nome do usuário autenticado.' })
  async updateProfile(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(currentUser.id, dto.name);
    return this.usersService.sanitize(user);
  }

  // LGPD art. 18, II: o titular pode obter tudo que a plataforma guarda sobre ele.
  @Get('me/export')
  @ApiOperation({ summary: 'Exporta, em JSON, todos os dados pessoais do usuário autenticado.' })
  exportData(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.privacyService.exportUserData(currentUser.id);
  }

  // LGPD art. 18, VI: eliminação. Anonimiza a conta e apaga o conteúdo pessoal,
  // preservando o histórico de doação que também pertence à outra parte.
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exclui a conta do usuário autenticado (anonimização).' })
  deleteAccount(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.privacyService.deleteAccount(currentUser.id);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Troca a senha do usuário autenticado.' })
  changePassword(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(currentUser.id, dto.currentPassword, dto.newPassword);
  }
}
