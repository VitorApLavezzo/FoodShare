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
    description:
      'Se true, a ONG pode aceitar a lista parcialmente (item a item, total ou parcial). Se false, só reserva tudo de uma vez.',
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

  @ApiProperty({
    required: false,
    description:
      'Prazo limite para retirada, aplicado aos itens sem prazo próprio. Obrigatório quando allowPartial=false (prazo único).',
  })
  @IsOptional()
  @IsDateString()
  pickupDeadline?: string;

  @ApiProperty({ required: false, description: 'Validade aplicada aos itens sem validade própria.' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
