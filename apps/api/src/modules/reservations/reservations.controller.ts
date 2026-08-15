import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista reservas (ONG vê as próprias; doador vê as feitas sobre suas doações; admin vê todas).',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.findMany(user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela uma reserva ativa e libera a doação novamente.' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reservationsService.cancel(user, id);
  }
}
