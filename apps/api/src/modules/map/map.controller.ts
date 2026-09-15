import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationKind, UserRole } from '@prisma/client';
import { MapService } from './map.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { MapDonationsQueryDto, MapOrganizationsQueryDto } from './dto/map-query.dto';

@ApiTags('map')
@ApiBearerAuth()
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Get('donors')
  @ApiOperation({ summary: 'Doadores aprovados com localização, para exibição no mapa.' })
  findDonors(@Query() query: MapOrganizationsQueryDto) {
    return this.mapService.findOrganizations(OrganizationKind.DONOR, query);
  }

  // Endereço exato de ONG não é dado público da plataforma: um doador não
  // precisa enumerar a localização de todas elas.
  @Get('ngos')
  @Roles(UserRole.NGO, UserRole.ADMIN)
  @ApiOperation({ summary: 'ONGs aprovadas com localização (visível para ONGs e administração).' })
  findNgos(@Query() query: MapOrganizationsQueryDto) {
    return this.mapService.findOrganizations(OrganizationKind.NGO, query);
  }

  @Get('donations')
  @ApiOperation({
    summary:
      'Doações disponíveis com localização do doador. Informe lat/lng para calcular distância e ordenar por proximidade.',
  })
  findDonations(@Query() query: MapDonationsQueryDto) {
    return this.mapService.findAvailableDonations(query);
  }
}
