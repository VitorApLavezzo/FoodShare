import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ConfirmPickupDto {
  @ApiProperty({ description: 'Código de retirada apresentado pela ONG.' })
  @IsString()
  @Length(6, 6)
  pickupCode!: string;
}
