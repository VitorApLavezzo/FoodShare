import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ConfirmPickupDto } from './dto/confirm-pickup.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('reservations')
@ApiBearerAuth()
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles(UserRole.NGO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Reserva um ou mais itens de uma lista de doação (requer ONG aprovada). Se a lista não permitir parcial, é preciso reservar todos os itens disponíveis por inteiro. Atômico por item: nunca é concedida mais quantidade do que existe.',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReservationDto) {
    return this.reservationsService.reserve(user, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Lista reservas (ONG vê as próprias; doador vê as feitas sobre suas doações; admin vê todas).',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.reservationsService.findMany(user);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela uma reserva ativa e devolve as quantidades aos itens.' })
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reservationsService.cancel(user, id);
  }

  @Post('confirm-pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirma a retirada presencial informando o código apresentado pela ONG (doador ou ONG podem confirmar).',
  })
  confirmPickup(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmPickupDto) {
    return this.reservationsService.confirmPickup(user, dto.pickupCode);
  }
}
