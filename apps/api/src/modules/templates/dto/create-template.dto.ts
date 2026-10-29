import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DonationRecurrence } from '@prisma/client';
import { CreateDonationItemDto } from '../../donations/dto/create-donation-item.dto';

const RECURRENCES = Object.values(DonationRecurrence);

export class CreateTemplateDto {
  @ApiProperty({ example: 'Sobra de padaria (fim do dia)' })
  @IsString()
  name!: string;

  @ApiProperty({ type: [CreateDonationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDonationItemDto)
  items!: CreateDonationItemDto[];

  @ApiProperty({ default: true })
  @IsBoolean()
  allowPartial: boolean = true;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ enum: RECURRENCES, description: 'DAILY (todo dia), WEEKDAYS (seg-sex) ou WEEKLY.' })
  @IsIn(RECURRENCES)
  recurrence!: DonationRecurrence;

  @ApiProperty({ minimum: 0, maximum: 23, description: 'Hora do dia em que a doação deve ser publicada.' })
  @IsInt()
  @Min(0)
  @Max(23)
  hourOfDay!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 6, description: 'Dia da semana (0=domingo), só para WEEKLY.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;

  // Mesmas regras da doação manual: retirada com pelo menos 1 dia a partir da
  // publicação, validade pelo menos 1 dia depois da retirada.
  @ApiPropertyOptional({
    default: 24,
    minimum: 24,
    description: 'Horas de janela para retirada a partir da publicação.',
  })
  @IsOptional()
  @IsInt()
  @Min(24)
  @Max(72)
  pickupWindowHours?: number;

  @ApiPropertyOptional({
    default: 48,
    minimum: 48,
    description: 'Horas até a validade a partir da publicação (ao menos 24h depois da janela de retirada).',
  })
  @IsOptional()
  @IsInt()
  @Min(48)
  @Max(168)
  expiresInHours?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
