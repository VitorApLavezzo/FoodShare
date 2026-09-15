import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserTokenPurpose } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const PASSWORD_SALT_ROUNDS = 12;
const RESET_TTL_MINUTES = 30;
const VERIFICATION_TTL_HOURS = 48;

/**
 * Recuperação de senha e verificação de e-mail.
 *
 * O token vai íntegro no e-mail e só o hash é guardado — vazamento do banco não
 * permite trocar a senha de ninguém. `requestPasswordReset` responde igual
 * existindo ou não a conta, senão o endpoint viraria um oráculo para descobrir
 * quais e-mails estão cadastrados.
 */
@Injectable()
export class AccountRecoveryService {
  private readonly logger = new Logger(AccountRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueToken(userId: string, purpose: UserTokenPurpose, expiresAt: Date) {
    const token = randomBytes(32).toString('hex');

    // Invalida tokens anteriores do mesmo propósito: só o último link vale.
    await this.prisma.userToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    });
    await this.prisma.userToken.create({
      data: { userId, purpose, tokenHash: this.hash(token), expiresAt },
    });

    return token;
  }

  private async consumeToken(token: string, purpose: UserTokenPurpose) {
    const record = await this.prisma.userToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { user: true },
    });

    if (!record || record.purpose !== purpose || record.usedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException({
        code: 'INVALID_TOKEN',
        message: 'Este link é inválido ou expirou. Solicite um novo.',
      });
    }

    await this.prisma.userToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record.user;
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.isActive && !user.deletedAt) {
      const token = await this.issueToken(
        user.id,
        UserTokenPurpose.PASSWORD_RESET,
        new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      );
      const link = `${this.config.get<string>('webAppUrl')}/redefinir-senha?token=${token}`;

      await this.mail.send({
        to: user.email,
        subject: 'Redefinição de senha - FoodShare',
        text: `Olá, ${user.name}.\n\nRecebemos um pedido para redefinir a senha da sua conta no FoodShare. Abra o link abaixo para escolher uma nova senha (válido por ${RESET_TTL_MINUTES} minutos):\n\n${link}\n\nSe não foi você, ignore este e-mail: sua senha continua a mesma.`,
      });
    }

    // Resposta idêntica nos dois casos, de propósito.
    return { message: 'Se existir uma conta com este e-mail, enviamos um link de redefinição.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.consumeToken(token, UserTokenPurpose.PASSWORD_RESET);

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // Trocar a senha derruba as sessões abertas — inclusive a de quem
      // eventualmente tenha se apossado da conta.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Senha redefinida. Faça login com a nova senha.' };
  }

  async sendVerificationEmail(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) {
      return { message: 'Este e-mail já foi verificado.' };
    }

    const token = await this.issueToken(
      user.id,
      UserTokenPurpose.EMAIL_VERIFICATION,
      new Date(Date.now() + VERIFICATION_TTL_HOURS * 3_600_000),
    );
    const link = `${this.config.get<string>('webAppUrl')}/verificar-email?token=${token}`;

    await this.mail.send({
      to: user.email,
      subject: 'Confirme seu e-mail - FoodShare',
      text: `Olá, ${user.name}.\n\nConfirme seu e-mail para que doadores e ONGs possam falar com você:\n\n${link}\n\nO link vale por ${VERIFICATION_TTL_HOURS} horas.`,
    });

    return { message: 'Enviamos um link de confirmação para o seu e-mail.' };
  }

  async verifyEmail(token: string) {
    const user = await this.consumeToken(token, UserTokenPurpose.EMAIL_VERIFICATION);
    await this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    return { message: 'E-mail confirmado.' };
  }
}
