import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationKind, UserRole } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('donors')
@ApiBearerAuth()
@Controller('donors')
export class DonorsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles(UserRole.DONOR)
  @ApiOperation({ summary: 'Cadastra o estabelecimento do doador autenticado.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user, OrganizationKind.DONOR, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista doadores (admin vê todos; doador vê apenas o próprio).' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findMany(user, OrganizationKind.DONOR);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um estabelecimento doador.' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizationsService.findOne(user, OrganizationKind.DONOR, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza um estabelecimento doador.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(user, OrganizationKind.DONOR, id, dto);
  }

  @Patch(':id/approval')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprova, reprova ou bloqueia um doador (admin).' })
  updateApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateApprovalDto,
  ) {
    return this.organizationsService.updateApproval(user, OrganizationKind.DONOR, id, dto.status);
  }
}
