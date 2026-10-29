import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Números públicos da plataforma, exibidos na página inicial.' })
  getPublicStats() {
    return this.dashboardService.getPublicStats();
  }

  @Get('donor')
  @Roles(UserRole.DONOR)
  @ApiOperation({
    summary: 'Métricas do doador autenticado: status das doações, quantidade doada, histórico.',
  })
  getDonorDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getDonorDashboard(user);
  }

  @Get('ngo')
  @Roles(UserRole.NGO)
  @ApiOperation({ summary: 'Métricas da ONG autenticada: reservas, retiradas, quantidade recebida.' })
  getNgoDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.getNgoDashboard(user);
  }

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Métricas globais da plataforma (admin).' })
  getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }
}
