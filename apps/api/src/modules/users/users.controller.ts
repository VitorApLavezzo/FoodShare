import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @Post('me/change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Troca a senha do usuário autenticado.' })
  changePassword(@CurrentUser() currentUser: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(currentUser.id, dto.currentPassword, dto.newPassword);
  }
}
