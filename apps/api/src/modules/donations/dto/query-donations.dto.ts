import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

export class QueryDonationsDto {
  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiPropertyOptional({ description: 'Busca por nome do alimento.' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtra por cidade do estabelecimento doador.' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
