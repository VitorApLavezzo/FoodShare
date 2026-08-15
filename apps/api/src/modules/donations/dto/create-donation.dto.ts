import { ApiProperty } from '@nestjs/swagger';
import { DonationCategory } from '@prisma/client';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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

export class CreateDonationDto {
  @ApiProperty()
  @IsString()
  foodName!: string;

  @ApiProperty({ enum: CATEGORIES })
  @IsIn(CATEGORIES)
  category!: DonationCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Deve ser maior que zero.' })
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @ApiProperty({ example: 'kg' })
  @IsString()
  unit!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  batch?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  storageCondition?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'Data/hora a partir de quando a doação pode ser retirada.' })
  @IsDateString()
  availableAt!: string;

  @ApiProperty({ description: 'Prazo limite para retirada.' })
  @IsDateString()
  pickupDeadline!: string;

  @ApiProperty({ description: 'Validade do alimento.' })
  @IsDateString()
  expiresAt!: string;
}
