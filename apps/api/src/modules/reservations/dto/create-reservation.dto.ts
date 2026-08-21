import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsUUID, ValidateNested } from 'class-validator';

export class ReservationItemInputDto {
  @ApiProperty()
  @IsUUID()
  donationItemId!: string;

  @ApiProperty({
    required: false,
    description: 'Quantidade desejada desse item. Se omitido, reserva tudo que resta.',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  quantity?: number;
}

export class CreateReservationDto {
  @ApiProperty()
  @IsUUID()
  donationListId!: string;

  @ApiProperty({ type: [ReservationItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReservationItemInputDto)
  items!: ReservationItemInputDto[];
}
