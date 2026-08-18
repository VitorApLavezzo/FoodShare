import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter ao menos 8 caracteres.' })
  @Matches(STRONG_PASSWORD_REGEX, {
    message: 'A nova senha deve ter ao menos 1 letra maiúscula, 1 número e 1 caractere especial.',
  })
  newPassword!: string;
}
