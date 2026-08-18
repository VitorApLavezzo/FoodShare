import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, Matches, MinLength } from 'class-validator';

const SELF_REGISTERABLE_ROLES = ['DONOR', 'NGO'] as const;
const STRONG_PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class RegisterDto {
  @ApiProperty({ example: 'contato@restaurante.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  @Matches(STRONG_PASSWORD_REGEX, {
    message: 'A senha deve ter ao menos 1 letra maiúscula, 1 número e 1 caractere especial.',
  })
  password!: string;

  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  name!: string;

  @ApiProperty({ enum: SELF_REGISTERABLE_ROLES })
  @IsIn(SELF_REGISTERABLE_ROLES, { message: 'role deve ser DONOR ou NGO.' })
  role!: 'DONOR' | 'NGO';
}
