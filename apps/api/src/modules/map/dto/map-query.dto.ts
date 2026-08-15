import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

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

export class MapDonationsQueryDto {
  @ApiPropertyOptional({ description: 'Latitude do ponto de referência (ex: localização da ONG).' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude do ponto de referência.' })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Raio de busca em km (requer lat/lng).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  radiusKm?: number;

  @ApiPropertyOptional({ enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @ApiPropertyOptional({ description: 'Quantidade mínima.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minQuantity?: number;
}

export class MapOrganizationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Raio de busca em km (requer lat/lng).' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  radiusKm?: number;
}
