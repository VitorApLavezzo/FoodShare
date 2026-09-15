import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { DonationCategory, DonationItemStatus } from '@prisma/client';
import { DONATION_CATEGORIES, DONATION_ITEM_STATUSES } from '../../../common/enum-values';

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

  @ApiPropertyOptional({ enum: DONATION_CATEGORIES })
  @IsOptional()
  @IsIn(DONATION_CATEGORIES)
  category?: DonationCategory;

  @ApiPropertyOptional({ enum: DONATION_ITEM_STATUSES })
  @IsOptional()
  @IsIn(DONATION_ITEM_STATUSES)
  status?: DonationItemStatus;

  @ApiPropertyOptional({ enum: FORMATS, default: 'json' })
  @IsOptional()
  @IsIn(FORMATS)
  format?: (typeof FORMATS)[number] = 'json';
}
