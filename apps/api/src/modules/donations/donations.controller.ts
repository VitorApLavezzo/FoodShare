import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { QueryDonationsDto } from './dto/query-donations.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ReservationsService } from '../reservations/reservations.service';
import { ConfirmPickupDto } from '../reservations/dto/confirm-pickup.dto';

@ApiTags('donations')
@ApiBearerAuth()
@Controller('donations')
export class DonationsController {
  constructor(
    private readonly donationsService: DonationsService,
    private readonly reservationsService: ReservationsService,
  ) {}

  @Post()
  @Roles(UserRole.DONOR)
  @ApiOperation({ summary: 'Publica uma nova doação (requer estabelecimento aprovado).' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDonationDto) {
    return this.donationsService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Lista doações. ONG vê apenas disponíveis e não expiradas; doador vê as próprias; admin vê todas.',
  })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: QueryDonationsDto) {
    return this.donationsService.findMany(user, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma doação.' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.donationsService.findOne(user, id);
  }

  @Put(':id')
  @Roles(UserRole.DONOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualiza uma doação ainda disponível.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDonationDto,
  ) {
    return this.donationsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.DONOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancela uma doação ainda disponível.' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.donationsService.cancel(user, id);
  }

  @Post(':id/reserve')
  @Roles(UserRole.NGO)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Reserva uma doação disponível (requer ONG aprovada). Atômico: apenas uma reserva vence em caso de disputa.',
  })
  reserve(@CurrentUser() user: AuthenticatedUser, @Param('id') donationId: string) {
    return this.reservationsService.reserve(user, donationId);
  }

  @Post(':id/confirm-pickup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirma a retirada presencial informando o código apresentado pela ONG (doador ou ONG podem confirmar).',
  })
  confirmPickup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') donationId: string,
    @Body() dto: ConfirmPickupDto,
  ) {
    return this.reservationsService.confirmPickup(user, donationId, dto.pickupCode);
  }
}
