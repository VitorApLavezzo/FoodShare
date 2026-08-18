import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class EmailAvailabilityDto {
  @ApiProperty({ example: 'contato@restaurante.com' })
  @IsEmail()
  email!: string;
}
