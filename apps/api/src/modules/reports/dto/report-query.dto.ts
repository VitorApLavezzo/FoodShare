import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

const CATEGORIES = [
  'PREPARED_MEALS',
  'FRUITS',
  'VEGETABLES',
  'LEGUMES',
  'PACKAGED_GOODS',
  'BAKERY',
  'BEVERAGES',
  'OTHER',
] as const;

const STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'PICKUP_PENDING',
  'PICKED_UP',
  'DISTRIBUTED',
  'EXPIRED',
  'CANCELLED',
] as const;

const FORMATS = ['json', 'csv'] as const;

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'ISO 8601, início do período.' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'ISO 8601, fim do período.' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  donorOrganizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ngoOrganizationId?: string;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ enum: FORMATS, default: 'json' })
  @IsOptional()
  @IsIn(FORMATS)
  format?: (typeof FORMATS)[number] = 'json';
}
