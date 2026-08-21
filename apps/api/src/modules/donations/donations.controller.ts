import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { UpdateDonationDto } from './dto/update-donation.dto';
import { QueryDonationsDto } from './dto/query-donations.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('donations')
@ApiBearerAuth()
@Controller('donations')
export class DonationsController {
  constructor(private readonly donationsService: DonationsService) {}

  @Post()
  @Roles(UserRole.DONOR)
  @ApiOperation({ summary: 'Publica uma nova lista de doação com um ou mais itens (requer estabelecimento aprovado).' })
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
  @ApiOperation({ summary: 'Detalha uma lista de doação e seus itens.' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.donationsService.findOne(user, id);
  }

  @Put(':id')
  @Roles(UserRole.DONOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Atualiza os dados de nível de lista (datas/notas) enquanto nenhum item foi reservado.' })
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
  @ApiOperation({ summary: 'Cancela uma lista de doação ainda sem itens reservados.' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.donationsService.cancel(user, id);
  }
}
