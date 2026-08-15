import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { NodesService } from './nodes.service';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('nodes')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('nodes')
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista todos os nós regionais e seu status.' })
  findAll() {
    return this.nodesService.findAll();
  }

  @Get(':code/health')
  @ApiOperation({ summary: 'Status de um nó específico.' })
  async findOne(@Param('code') code: string) {
    const node = await this.nodesService.findByCode(code);
    if (!node) throw new NotFoundException('Nó não encontrado.');
    return node;
  }
}
