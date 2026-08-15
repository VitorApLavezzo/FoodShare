import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class AddressDto {
  @ApiProperty()
  @IsString()
  street!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  complement?: string;

  @ApiProperty()
  @IsString()
  neighborhood!: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiProperty()
  @IsString()
  state!: string;

  @ApiProperty()
  @IsString()
  zipCode!: string;

  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;
}
