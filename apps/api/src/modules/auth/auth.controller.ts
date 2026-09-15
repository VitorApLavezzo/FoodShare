import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AccountRecoveryService } from './account-recovery.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { EmailAvailabilityDto } from './dto/email-availability.dto';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto, ResetPasswordDto, VerifyEmailDto } from './dto/account-recovery.dto';
import { CurrentUser, type AuthenticatedUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly accountRecovery: AccountRecoveryService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Cadastra um novo usuário doador ou ONG.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('email-availability')
  @ApiOperation({ summary: 'Verifica se um e-mail já está cadastrado.' })
  checkEmailAvailability(@Query() query: EmailAvailabilityDto) {
    return this.authService.checkEmailAvailability(query.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentica e retorna access/refresh token.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renova o access token usando um refresh token válido.' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // Limite apertado: é um endpoint público que dispara e-mail.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Envia o link de redefinição de senha. Responde igual existindo ou não a conta, para não revelar quais e-mails estão cadastrados.',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.accountRecovery.requestPasswordReset(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Define uma nova senha a partir do token recebido por e-mail.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.accountRecovery.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirma o e-mail a partir do token enviado.' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.accountRecovery.verifyEmail(dto.token);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenvia o e-mail de confirmação para o usuário autenticado.' })
  resendVerification(@CurrentUser() user: AuthenticatedUser) {
    return this.accountRecovery.sendVerificationEmail(user.id);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoga o refresh token informado.' })
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }
}
