import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

const PASSWORD_SALT_ROUNDS = 12;

export type SafeUser = Omit<User, 'passwordHash'>;

interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  nodeId: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(input: CreateUserInput) {
    return this.prisma.user.create({
      data: { ...input, email: input.email.toLowerCase() },
    });
  }

  async updateProfile(id: string, name: string) {
    return this.prisma.user.update({ where: { id }, data: { name } });
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Senha atual incorreta.',
      });
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_UNCHANGED',
        message: 'A nova senha deve ser diferente da atual.',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { success: true };
  }

  sanitize(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
