import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { parseDurationMs } from '../../common/parse-duration';

const PASSWORD_SALT_ROUNDS = 12;
const REFRESH_TOKEN_HASH_ROUNDS = 10;

interface RefreshPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async checkEmailAvailability(email: string) {
    const existing = await this.usersService.findByEmail(email);
    return { available: !existing };
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'Já existe uma conta com este e-mail.',
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      role: dto.role,
      passwordHash,
      nodeId: this.config.get<string>('node.id')!,
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha inválidos.',
      });
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'E-mail ou senha inválidos.',
      });
    }

    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const payload = this.verifyRefreshToken(refreshToken);

    const record = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Sessão expirada, faça login novamente.',
      });
    }

    const tokenMatches = await bcrypt.compare(refreshToken, record.token);
    if (!tokenMatches) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Sessão expirada, faça login novamente.',
      });
    }

    // Rotação: o refresh token usado é sempre revogado, mesmo em caso de reuso indevido.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.usersService.findById(record.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: 'Usuário inválido.' });
    }

    return this.issueTokens(user);
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.verifyRefreshToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Token já inválido/expirado: logout é idempotente, não é um erro.
    }
    return { success: true };
  }

  private verifyRefreshToken(refreshToken: string): RefreshPayload {
    try {
      return this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Sessão expirada, faça login novamente.',
      });
    }
  }

  private async issueTokens(user: User) {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role, nodeId: user.nodeId },
      {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get<string>('jwt.expiresIn') as unknown as number,
      },
    );

    const jti = randomUUID();
    const refreshExpiresIn = this.config.get<string>('jwt.refreshExpiresIn')!;
    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: refreshExpiresIn as unknown as number,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        token: await bcrypt.hash(refreshToken, REFRESH_TOKEN_HASH_ROUNDS),
        expiresAt: new Date(Date.now() + parseDurationMs(refreshExpiresIn)),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: this.usersService.sanitize(user),
    };
  }
}
