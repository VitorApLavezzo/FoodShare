import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateDonationItemDto } from './create-donation-item.dto';

export class CreateDonationDto {
  @ApiProperty({
    type: [CreateDonationItemDto],
    description: 'Itens da lista de doação (mínimo 1).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDonationItemDto)
  items!: CreateDonationItemDto[];

  @ApiProperty({
    default: true,
    description: 'Se true, a ONG pode aceitar a lista parcialmente (item a item, total ou parcial). Se false, só reserva tudo de uma vez.',
  })
  @IsBoolean()
  allowPartial: boolean = true;

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

  @ApiProperty({ description: 'Validade da lista.' })
  @IsDateString()
  expiresAt!: string;
}
