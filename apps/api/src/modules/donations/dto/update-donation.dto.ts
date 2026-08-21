import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { CreateDonationDto } from './create-donation.dto';

// Edição limitada aos campos de nível de lista; os itens não podem mais ser
// alterados após a criação (evita reconciliar quantidades já reservadas).
export class UpdateDonationDto extends PartialType(
  PickType(CreateDonationDto, ['availableAt', 'pickupDeadline', 'expiresAt'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
