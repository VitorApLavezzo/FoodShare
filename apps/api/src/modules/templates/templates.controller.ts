import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('donation-templates')
@ApiBearerAuth()
@Roles(UserRole.DONOR, UserRole.ADMIN)
@Controller('donation-templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um modelo de doação recorrente (ex.: sobra de padaria todo dia às 20h).' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTemplateDto) {
    return this.templatesService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os modelos recorrentes do estabelecimento.' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.findMany(user);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualiza um modelo (inclusive pausar/retomar via isActive).' })
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um modelo recorrente.' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.templatesService.remove(user, id);
  }
}
