import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrganizationKind, UserRole } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ngos')
@ApiBearerAuth()
@Controller('ngos')
export class NgosController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles(UserRole.NGO)
  @ApiOperation({ summary: 'Cadastra a instituição da ONG autenticada.' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user, OrganizationKind.NGO, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista ONGs (admin vê todas; ONG vê apenas a própria).' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findMany(user, OrganizationKind.NGO);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha uma ONG.' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.organizationsService.findOne(user, OrganizationKind.NGO, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza uma ONG.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(user, OrganizationKind.NGO, id, dto);
  }

  @Patch(':id/approval')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Aprova, reprova ou bloqueia uma ONG (admin).' })
  updateApproval(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateApprovalDto,
  ) {
    return this.organizationsService.updateApproval(user, OrganizationKind.NGO, id, dto.status);
  }
}
