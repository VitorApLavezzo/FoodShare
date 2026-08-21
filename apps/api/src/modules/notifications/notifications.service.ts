import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApprovalStatus, DonationList, NotificationType, OrganizationKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { haversineKm } from '../../common/geo';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const MAX_CANDIDATES = 500;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Alerta ONGs aprovadas dentro do raio da doação recém-publicada. Cada ONG
   * pode definir seu próprio raio (Organization.notificationRadiusKm); quando
   * não definido, usa o padrão global (env NOTIFICATION_RADIUS_KM, 50km).
   * Sem filtro de categoria nesta fase: qualquer alimento disponibilizado
   * gera alerta para quem está no raio.
   */
  async notifyNearbyNgos(donationList: DonationList, donorAddressId: string) {
    const donorAddress = await this.prisma.address.findUniqueOrThrow({ where: { id: donorAddressId } });
    const defaultRadiusKm = this.config.get<number>('notifications.radiusKm') ?? 50;

    const ngoOrganizations = await this.prisma.organization.findMany({
      where: { kind: OrganizationKind.NGO, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
      include: { address: true, users: true },
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
      .filter(({ distanceKm, radiusKm }) => distanceKm <= radiusKm);

    const title = 'Nova doação disponível perto de você';
    const notifications = nearby.flatMap(({ org, radiusKm }) =>
      org.users.map((u) => ({
        userId: u.userId,
        title,
        message: `Uma nova lista de doação foi publicada a menos de ${radiusKm}km da sua ONG.`,
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

    for (const n of notifications) {
      this.realtimeGateway.emitToUser(n.userId, 'notification:new', {
        type: NotificationType.NEW_DONATION_NEARBY,
        title: n.title,
        message: n.message,
        donationListId: donationList.id,
      });
    }
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
      this.realtimeGateway.emitToUser(n.userId, 'notification:removed', { id: n.id });
    }
  }

  async deleteOne(userId: string, id: string) {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  async deleteAll(userId: string) {
    return this.prisma.notification.deleteMany({ where: { userId } });
  }
}
