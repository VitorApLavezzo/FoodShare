import { ApiProperty } from '@nestjs/swagger';
import { DonationCategory } from '@prisma/client';
import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
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

  @ApiProperty({ required: false, description: 'URL devolvida por POST /uploads/images.' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({ required: false, description: 'Alergênicos presentes (ex.: contém glúten, leite).' })
  @IsOptional()
  @IsString()
  allergens?: string;

  @ApiProperty({
    required: false,
    description:
      'Prazo de retirada deste item. Só pode variar entre itens quando a lista aceita reserva parcial; sem ele, vale o prazo da lista.',
  })
  @IsOptional()
  @IsDateString()
  pickupDeadline?: string;

  @ApiProperty({
    required: false,
    description: 'Validade deste alimento. Sem ela, vale a validade da lista.',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
