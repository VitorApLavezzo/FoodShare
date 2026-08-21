import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { DONATION_CATEGORIES } from './create-donation-item.dto';

export class QueryDonationsDto {
  @ApiPropertyOptional({ enum: DONATION_CATEGORIES, description: 'Filtra listas que contenham algum item dessa categoria.' })
  @IsOptional()
  @IsIn(DONATION_CATEGORIES)
  category?: (typeof DONATION_CATEGORIES)[number];

  @ApiPropertyOptional({ description: 'Busca por nome de alimento em algum item da lista.' })
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
