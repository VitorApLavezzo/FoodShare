import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalStatus,
  DonationCategory,
  DonationList,
  NotificationType,
  OrganizationKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { haversineKm } from '../../common/geo';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { MailService } from '../mail/mail.service';

const MAX_CANDIDATES = 500;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
    private readonly mail: MailService,
  ) {}

  /**
   * Alerta ONGs aprovadas dentro do raio da doação recém-publicada. Cada ONG
   * define seu próprio raio (Organization.notificationRadiusKm, caindo no
   * padrão global) e, opcionalmente, as categorias que lhe interessam — sem
   * esse filtro toda ONG recebia alerta de tudo e o sino virava ruído.
   *
   * O alerta sai por três canais: registro no banco (histórico), WebSocket
   * (quem está com a aba aberta vê na hora) e e-mail — este último é o que
   * alcança quem não está olhando o sistema, que é a maioria dos casos numa
   * janela de poucas horas.
   */
  async notifyNearbyNgos(
    donationList: DonationList & {
      items?: { category: DonationCategory; foodName: string }[];
    },
    donorAddressId: string,
  ) {
    const donorAddress = await this.prisma.address.findUniqueOrThrow({
      where: { id: donorAddressId },
    });
    const defaultRadiusKm = this.config.get<number>('notifications.radiusKm') ?? 50;
    const categories = donationList.items?.map((i) => i.category) ?? [];

    const ngoOrganizations = await this.prisma.organization.findMany({
      where: {
        kind: OrganizationKind.NGO,
        approvalStatus: ApprovalStatus.APPROVED,
        deletedAt: null,
      },
      include: { address: true, users: { include: { user: true } } },
      take: MAX_CANDIDATES,
    });

    const nearby = ngoOrganizations
      .map((org) => ({
        org,
        radiusKm: org.notificationRadiusKm ?? defaultRadiusKm,
        distanceKm: haversineKm(
          donorAddress.latitude,
          donorAddress.longitude,
          org.address.latitude,
          org.address.longitude,
        ),
      }))
      .filter(({ distanceKm, radiusKm }) => distanceKm <= radiusKm)
      .filter(({ org }) => this.matchesCategories(org.notificationCategories, categories));

    const title = 'Nova doação disponível perto de você';
    const notifications = nearby.flatMap(({ org, radiusKm, distanceKm }) =>
      org.users.map((link) => ({
        userId: link.userId,
        email: link.user?.email,
        emailVerified: !!link.user?.emailVerifiedAt,
        title,
        message: `Uma nova lista de doação foi publicada a ${Math.round(distanceKm)}km da sua ONG (seu raio é de ${radiusKm}km).`,
      })),
    );
    if (notifications.length === 0) return;

    await this.prisma.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        type: NotificationType.NEW_DONATION_NEARBY,
        title: n.title,
        message: n.message,
        donationListId: donationList.id,
      })),
    });

    const link = `${this.config.get<string>('webAppUrl')}/doacoes/${donationList.id}`;
    const itemNames = donationList.items?.map((i) => i.foodName).join(', ') ?? '';

    for (const n of notifications) {
      this.realtimeGateway.emitToUser(n.userId, 'notification:new', {
        type: NotificationType.NEW_DONATION_NEARBY,
        title: n.title,
        message: n.message,
        donationListId: donationList.id,
      });

      // Só para e-mail confirmado: evita disparar mensagem para endereço
      // digitado errado no cadastro.
      if (n.email && n.emailVerified) {
        void this.mail.send({
          to: n.email,
          subject: title,
          text: `${n.message}\n\n${itemNames ? `Itens: ${itemNames}\n\n` : ''}Veja os detalhes e reserve em:\n${link}`,
        });
      }
    }
  }

  /**
   * Avisa as ONGs que tinham reserva ativa numa doação que o doador cancelou.
   * Vai por e-mail além do sino: a ONG pode já ter organizado transporte para a
   * retirada, e descobrir o cancelamento só ao abrir o sistema é tarde demais.
   */
  async notifyReservationsCancelledByDonor(
    donationListId: string,
    ngoOrganizationIds: string[],
    itemNames: string,
  ) {
    const links = await this.prisma.organizationUser.findMany({
      where: { organizationId: { in: ngoOrganizationIds } },
      include: { user: true },
    });
    if (links.length === 0) return;

    const title = 'Doação cancelada pelo doador';
    const message = itemNames
      ? `O doador cancelou a doação de ${itemNames}. Sua reserva foi desfeita e não há retirada a fazer.`
      : 'O doador cancelou a doação. Sua reserva foi desfeita e não há retirada a fazer.';

    await this.prisma.notification.createMany({
      data: links.map((link) => ({
        userId: link.userId,
        type: NotificationType.GENERIC,
        title,
        message,
        // Sem donationListId: a lista cancelada não tem mais nada para abrir, e
        // o removeForDonationList apagaria este aviso junto com os de "doação
        // disponível" se eles ficassem ligados à mesma lista.
      })),
    });

    for (const link of links) {
      this.realtimeGateway.emitToUser(link.userId, 'notification:new', {
        type: NotificationType.GENERIC,
        title,
        message,
        donationListId,
      });

      if (link.user?.email && link.user.emailVerifiedAt) {
        void this.mail.send({
          to: link.user.email,
          subject: title,
          text: message,
        });
      }
    }
  }

  /**
   * Avisa o doador de que uma ONG reservou a doação dele. Sem isso, o doador
   * só descobria a reserva abrindo o painel — e é ele quem precisa separar o
   * alimento e estar lá para conferir o código na retirada.
   */
  async notifyDonorOfReservation(params: {
    donationListId: string;
    donorOrganizationId: string;
    ngoName: string;
    itemsSummary: string;
  }) {
    const links = await this.prisma.organizationUser.findMany({
      where: { organizationId: params.donorOrganizationId },
      include: { user: true },
    });
    if (links.length === 0) return;

    const title = 'Sua doação foi reservada';
    const message = `${params.ngoName} reservou ${params.itemsSummary}. Separe os itens e confira o código na retirada.`;

    await this.prisma.notification.createMany({
      data: links.map((link) => ({
        userId: link.userId,
        type: NotificationType.DONATION_RESERVED,
        title,
        message,
        donationListId: params.donationListId,
      })),
    });

    const appUrl = this.config.get<string>('webAppUrl');
    for (const link of links) {
      this.realtimeGateway.emitToUser(link.userId, 'notification:new', {
        type: NotificationType.DONATION_RESERVED,
        title,
        message,
        donationListId: params.donationListId,
      });

      if (link.user?.email && link.user.emailVerifiedAt) {
        void this.mail.send({
          to: link.user.email,
          subject: title,
          text: `${message}\n\nVeja as reservas recebidas em:\n${appUrl}/dashboard#reservas-recebidas`,
        });
      }
    }
  }

  /** Sem preferência declarada, a ONG recebe tudo (padrão). */
  private matchesCategories(preferred: DonationCategory[], donationCategories: DonationCategory[]) {
    if (preferred.length === 0 || donationCategories.length === 0) return true;
    return donationCategories.some((category) => preferred.includes(category));
  }

  async findMany(userId: string, params: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const where = { userId, ...(params.unreadOnly ? { readAt: null } : {}) };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  /**
   * Remove os alertas "doação disponível" ligados a uma lista que deixou de
   * estar disponível (cancelada/expirada) — evita notificação sobre algo que
   * a ONG não pode mais reservar. Avisa quem estava com o sino aberto via WS.
   */
  async removeForDonationList(donationListId: string) {
    const notifications = await this.prisma.notification.findMany({
      where: { donationListId, type: NotificationType.NEW_DONATION_NEARBY },
      select: { id: true, userId: true },
    });
    if (notifications.length === 0) return;

    await this.prisma.notification.deleteMany({
      where: { id: { in: notifications.map((n) => n.id) } },
    });

    for (const n of notifications) {
      this.realtimeGateway.emitToUser(n.userId, 'notification:removed', {
        id: n.id,
      });
    }
  }

  async deleteOne(userId: string, id: string) {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  async deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({ where: { userId } });
  }
}
