import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CreateDonationDto } from './create-donation.dto';

export class UpdateDonationItemDatesDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  pickupDeadline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

// Edição limitada a datas e observações; alimentos e quantidades não mudam
// após a criação (evita reconciliar quantidades já reservadas). As datas da
// lista valem para todos os itens; as de `items`, só para o item indicado.
export class UpdateDonationDto extends PartialType(
  PickType(CreateDonationDto, ['availableAt', 'pickupDeadline', 'expiresAt'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [UpdateDonationItemDatesDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDonationItemDatesDto)
  items?: UpdateDonationItemDatesDto[];
}
