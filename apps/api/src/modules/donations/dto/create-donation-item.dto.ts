import { ApiProperty } from '@nestjs/swagger';
import { DonationCategory } from '@prisma/client';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { DONATION_CATEGORIES } from '../../../common/enum-values';

export class CreateDonationItemDto {
  @ApiProperty()
  @IsString()
  foodName!: string;

  @ApiProperty({ enum: DONATION_CATEGORIES })
  @IsIn(DONATION_CATEGORIES)
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
}
