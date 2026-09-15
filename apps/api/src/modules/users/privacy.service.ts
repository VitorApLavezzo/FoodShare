import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Direitos do titular previstos na LGPD: acesso aos próprios dados (art. 18, II)
 * e eliminação (art. 18, VI).
 *
 * A exclusão anonimiza em vez de apagar as linhas: os registros de doação e
 * retirada são o histórico de outra organização também (e base de prestação de
 * contas), então o vínculo pessoal é removido e o fato permanece. Mensagens de
 * chat, que são conteúdo pessoal, essas sim são apagadas.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async exportUserData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        organizationLinks: { include: { organization: { include: { address: true } } } },
        notifications: true,
        messages: { select: { id: true, conversationId: true, body: true, createdAt: true } },
        pickupsConfirmed: true,
      },
    });

    const organizationIds = user.organizationLinks.map((link) => link.organizationId);
    const [donationLists, reservations] = await Promise.all([
      this.prisma.donationList.findMany({
        where: { donorOrganizationId: { in: organizationIds } },
        include: { items: true },
      }),
      this.prisma.reservation.findMany({
        where: { ngoOrganizationId: { in: organizationIds } },
        include: { items: { include: { donationItem: true } } },
      }),
    ]);

    const { passwordHash, ...safeUser } = user;
    return {
      geradoEm: new Date().toISOString(),
      usuario: safeUser,
      organizacoes: user.organizationLinks.map((link) => link.organization),
      doacoesPublicadas: donationLists,
      reservas: reservations,
    };
  }

  async deleteAccount(userId: string) {
    const anonymousEmail = `removido+${randomUUID()}@foodshare.invalid`;

    await this.prisma.$transaction([
      this.prisma.message.deleteMany({ where: { senderUserId: userId } }),
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.userToken.deleteMany({ where: { userId } }),
      // Desvincula das organizações: sem isso, quem saiu continuaria "dentro"
      // de um estabelecimento que segue operando.
      this.prisma.organizationUser.deleteMany({ where: { userId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          email: anonymousEmail,
          name: 'Usuário removido',
          isActive: false,
          deletedAt: new Date(),
          emailVerifiedAt: null,
        },
      }),
    ]);

    this.logger.log(`Conta ${userId} anonimizada a pedido do titular.`);
    return { message: 'Conta excluída. Seus dados pessoais foram removidos.' };
  }
}
