import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { toCsv } from '../../common/to-csv';

const DONATIONS_REPORT_COLUMNS = [
  'donationId',
  'foodName',
  'category',
  'quantity',
  'unit',
  'status',
  'donorName',
  'donorCity',
  'donorState',
  'ngoName',
  'createdAt',
  'pickupDeadline',
  'expiresAt',
] as const;

@ApiTags('reports')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('donations')
  @ApiOperation({
    summary:
      'Relatório de doações filtrável por período/cidade/categoria/status/doador/ONG. format=csv exporta CSV.',
  })
  async getDonationsReport(@Query() query: ReportQueryDto, @Res() res: Response) {
    const rows = await this.reportsService.findDonationsReport(query);

    if (query.format === 'csv') {
      const csv = toCsv(rows, [...DONATIONS_REPORT_COLUMNS]);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="doacoes.csv"');
      res.send(csv);
      return;
    }

    res.json(rows);
  }

  @Get('impact')
  @ApiOperation({ summary: 'Métricas de impacto (estimativas) filtráveis por período/cidade.' })
  getImpactReport(@Query() query: ReportQueryDto) {
    return this.reportsService.getImpactReport(query);
  }
}
