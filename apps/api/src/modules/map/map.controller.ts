import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationKind, UserRole } from '@prisma/client';
import { MapService } from './map.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { MapDonationsQueryDto, MapOrganizationsQueryDto } from './dto/map-query.dto';

@ApiTags('map')
@ApiBearerAuth()
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  // Cada papel vê no mapa só o que usa: a ONG procura comida (doações e
  // doadores); o doador vê o alcance das próprias doações (/map/reach); a
  // administração vê a rede inteira.
  @Get('donors')
  @Roles(UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({ summary: 'Doadores aprovados com localização (visível para ONGs e administração).' })
  findDonors(@Query() query: MapOrganizationsQueryDto) {
    return this.mapService.findOrganizations(OrganizationKind.DONOR, query);
  }

  // Endereço exato de ONG não é dado público da plataforma — nem para doadores,
  // nem para outras ONGs, que não têm o que fazer com a localização umas das outras.
  @Get('ngos')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'ONGs aprovadas com localização (visível só para a administração).' })
  findNgos(@Query() query: MapOrganizationsQueryDto) {
    return this.mapService.findOrganizations(OrganizationKind.NGO, query);
  }

  @Get('reach')
  @Roles(UserRole.DONOR)
  @ApiOperation({
    summary: 'Quantas ONGs, e em que cidades, recebem alerta quando o doador autenticado publica uma doação.',
  })
  findReach(@CurrentUser() user: AuthenticatedUser) {
    return this.mapService.findDonorReach(user.id);
  }

  @Get('donations')
  @Roles(UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Doações disponíveis com localização do doador. Informe lat/lng para calcular distância e ordenar por proximidade.',
  })
  findDonations(@Query() query: MapDonationsQueryDto) {
    return this.mapService.findAvailableDonations(query);
  }
}
