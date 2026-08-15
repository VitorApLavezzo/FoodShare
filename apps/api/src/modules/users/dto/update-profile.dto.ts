import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;
}
