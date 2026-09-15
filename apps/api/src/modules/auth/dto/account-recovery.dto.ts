import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

// Mesma regra de força do cadastro: se a redefinição aceitasse senha fraca,
// a exigência do cadastro não valeria de nada.
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class ForgotPasswordDto {
  @ApiProperty({ example: 'contato@restaurante.com' })
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  @Matches(STRONG_PASSWORD_REGEX, {
    message: 'A senha deve ter ao menos 1 letra maiúscula, 1 número e 1 caractere especial.',
  })
  password!: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token!: string;
}
