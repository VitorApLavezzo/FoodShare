import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { DonationCategory, OrganizationType } from '@prisma/client';
import { DONATION_CATEGORIES } from '../../../common/enum-values';
import { AddressDto } from './address.dto';
import { IsCnpj } from '../../../common/validators/is-cnpj.validator';

const ORGANIZATION_TYPES = ['RESTAURANT', 'MARKET', 'BAKERY', 'OTHER'] as const;

export class CreateOrganizationDto {
  @ApiProperty()
  @IsString()
  legalName!: string;

  @ApiProperty()
  @IsString()
  tradeName!: string;

  @ApiProperty({ description: 'CNPJ.' })
  @IsString()
  @IsCnpj({ message: 'CNPJ inválido.' })
  document!: string;

  @ApiProperty({ enum: ORGANIZATION_TYPES, required: false, description: 'Apenas para doadores.' })
  @IsOptional()
  @IsIn(ORGANIZATION_TYPES)
  type?: OrganizationType;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  responsibleName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  operatingHours?: string;

  @ApiProperty({ required: false, description: 'Capacidade estimada de atendimento (apenas ONG).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedCapacity?: number;

  @ApiProperty({
    required: false,
    description:
      'Raio (km) para receber alertas de doação próxima (apenas ONG). Se omitido, usa o padrão da plataforma.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  notificationRadiusKm?: number;

  @ApiProperty({
    required: false,
    isArray: true,
    enum: DONATION_CATEGORIES,
    description:
      'Categorias de alimento que interessam à ONG. Lista vazia (padrão) = recebe alerta de qualquer categoria.',
  })
  @IsOptional()
  @IsArray()
  @IsIn(DONATION_CATEGORIES, { each: true })
  notificationCategories?: DonationCategory[];

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
}
