import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApprovalStatus,
  DonationItemStatus,
  DonationListStatus,
  OrganizationKind,
  Prisma,
  ReservationStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { haversineKm } from '../../common/geo';

const MONTHS_BACK = 6;
const MAX_NEARBY_CANDIDATES = 500;

export interface MonthlyRow {
  month: string;
  count: number;
  quantity: number;
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

// Doação cancelada pelo doador não aconteceu: fica fora das métricas.
const NOT_CANCELLED = {
  status: { not: DonationItemStatus.CANCELLED },
} satisfies Prisma.DonationItemWhereInput;

/**
 * Entregue sobre ofertado, em %. O teto de 100% cobre o item retirado em parte
 * e cancelado depois: a parte entregue conta, a oferta cancelada não.
 */
function utilizationRate(delivered: number, offered: number) {
  if (offered === 0) return 0;
  return Math.min(100, Math.round((delivered / offered) * 1000) / 10);
}

function monthsAgo(n: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (n - 1), 1);
}

/**
 * As métricas são agregadas em SQL. Antes, cada painel carregava a tabela
 * inteira de itens (com joins aninhados) para somar em JavaScript — não
 * escalava e ainda produzia números errados (ex.: taxa de aproveitamento
 * passando de 100%).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Quantos doadores e ONGs têm conta na plataforma. A página inicial mostrava
   * um "3" fixo (os três papéis de acesso), que parecia um contador travado.
   * Só a contagem: nada que identifique alguém sai por esta rota pública.
   */
  async getPublicStats() {
    const profiles = await this.prisma.user.count({
      where: { role: { in: [UserRole.DONOR, UserRole.NGO] }, isActive: true, deletedAt: null },
    });
    return { profiles };
  }

  async getDonorDashboard(user: AuthenticatedUser) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organization: { kind: OrganizationKind.DONOR } },
    });
    if (!link) return this.emptyDonorDashboard();

    const listWhere: Prisma.DonationListWhereInput = {
      donorOrganizationId: link.organizationId,
      deletedAt: null,
    };
    const itemWhere: Prisma.DonationItemWhereInput = { donationList: listWhere, ...NOT_CANCELLED };

    const [statusGroups, offered, delivered, completedPickups, monthly, recentHistory] = await Promise.all([
      this.prisma.donationItem.groupBy({
        by: ['status'],
        where: itemWhere,
        _count: { _all: true },
      }),
      this.prisma.donationItem.aggregate({
        where: itemWhere,
        _sum: { quantity: true },
      }),
      this.prisma.reservationItem.aggregate({
        where: {
          reservation: { status: ReservationStatus.COMPLETED, donationList: listWhere },
        },
        _sum: { quantity: true },
      }),
      // O status do item não distingue "reservado" de "já retirado" (os dois
      // ficam FULLY_RESERVED); a retirada concluída mora na reserva.
      this.prisma.reservation.count({
        where: { status: ReservationStatus.COMPLETED, donationList: listWhere },
      }),
      this.monthlySeries(link.organizationId),
      this.prisma.donationItem.findMany({
        where: itemWhere,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, foodName: true, status: true, quantity: true, unit: true, updatedAt: true },
      }),
    ]);

    const totalQuantityOffered = offered._sum.quantity?.toNumber() ?? 0;
    const totalQuantityDonated = delivered._sum.quantity?.toNumber() ?? 0;

    return {
      totals: this.toStatusTotals(statusGroups),
      completedPickups,
      totalQuantityDonated,
      totalQuantityOffered,
      // Aproveitamento por quantidade (não por contagem de itens): é o que não
      // deixa a taxa ultrapassar 100% quando um item é retirado só em parte.
      utilizationRatePercent: utilizationRate(totalQuantityDonated, totalQuantityOffered),
      monthly,
      recentHistory,
    };
  }

  async getNgoDashboard(user: AuthenticatedUser) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organization: { kind: OrganizationKind.NGO } },
      include: { organization: { include: { address: true } } },
    });

    if (!link) {
      return {
        availableNearby: 0,
        activeReservations: 0,
        completedPickups: 0,
        totalQuantityReceived: 0,
        recentHistory: [],
      };
    }

    const reservationWhere: Prisma.ReservationWhereInput = { ngoOrganizationId: link.organizationId };

    const [availableNearby, activeReservations, completedPickups, received, recentItems] = await Promise.all([
      this.countAvailableNearby(link.organization),
      this.prisma.reservation.count({ where: { ...reservationWhere, status: ReservationStatus.ACTIVE } }),
      this.prisma.reservation.count({ where: { ...reservationWhere, status: ReservationStatus.COMPLETED } }),
      this.prisma.reservationItem.aggregate({
        where: { reservation: { ...reservationWhere, status: ReservationStatus.COMPLETED } },
        _sum: { quantity: true },
      }),
      this.prisma.reservationItem.findMany({
        where: { reservation: reservationWhere },
        include: { reservation: { select: { status: true, reservedAt: true } }, donationItem: true },
        orderBy: { reservation: { reservedAt: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      availableNearby,
      activeReservations,
      completedPickups,
      totalQuantityReceived: received._sum.quantity?.toNumber() ?? 0,
      recentHistory: recentItems.map((ri) => ({
        id: ri.id,
        foodName: ri.donationItem.foodName,
        status: ri.reservation.status,
        quantity: ri.quantity,
        unit: ri.donationItem.unit,
        reservedAt: ri.reservation.reservedAt,
      })),
    };
  }

  async getAdminDashboard() {
    const listWhere: Prisma.DonationListWhereInput = { deletedAt: null };
    const itemWhere: Prisma.DonationItemWhereInput = { donationList: listWhere, ...NOT_CANCELLED };

    const [
      donorCount,
      ngoCount,
      statusGroups,
      offered,
      delivered,
      nodes,
      monthly,
      byCity,
      byCategory,
      topDonors,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { kind: OrganizationKind.DONOR, deletedAt: null } }),
      this.prisma.organization.count({ where: { kind: OrganizationKind.NGO, deletedAt: null } }),
      this.prisma.donationItem.groupBy({
        by: ['status'],
        where: itemWhere,
        _count: { _all: true },
      }),
      this.prisma.donationItem.aggregate({ where: itemWhere, _sum: { quantity: true } }),
      this.prisma.reservationItem.aggregate({
        where: { reservation: { status: ReservationStatus.COMPLETED } },
        _sum: { quantity: true },
      }),
      this.prisma.node.findMany(),
      this.monthlySeries(),
      this.prisma.$queryRaw<{ city: string; count: number }[]>`
        SELECT a.city, COUNT(*)::int AS count
        FROM donation_items di
        JOIN donation_lists dl ON dl.id = di."donationListId"
        JOIN organizations o ON o.id = dl."donorOrganizationId"
        JOIN addresses a ON a.id = o."addressId"
        WHERE dl."deletedAt" IS NULL AND di.status <> 'CANCELLED'
        GROUP BY a.city
        ORDER BY count DESC`,
      this.prisma.donationItem.groupBy({
        by: ['category'],
        where: itemWhere,
        _count: { _all: true },
      }),
      this.prisma.$queryRaw<{ name: string; count: number }[]>`
        SELECT o."tradeName" AS name, COUNT(*)::int AS count
        FROM donation_items di
        JOIN donation_lists dl ON dl.id = di."donationListId"
        JOIN organizations o ON o.id = dl."donorOrganizationId"
        WHERE dl."deletedAt" IS NULL AND di.status <> 'CANCELLED'
        GROUP BY o.id, o."tradeName"
        ORDER BY count DESC
        LIMIT 5`,
    ]);

    const totals = this.toStatusTotals(statusGroups);
    const totalQuantityOffered = offered._sum.quantity?.toNumber() ?? 0;
    const totalQuantityDonated = delivered._sum.quantity?.toNumber() ?? 0;
    const now = Date.now();

    return {
      totals: {
        donors: donorCount,
        ngos: ngoCount,
        donationsAvailable: totals.AVAILABLE,
        donationsCompleted: totals.FULLY_RESERVED,
        donationsExpired: totals.EXPIRED,
        totalQuantityDonated,
        nodesOnline: nodes.filter((n) => n.lastHeartbeat && now - n.lastHeartbeat.getTime() < 45_000).length,
        nodesTotal: nodes.length,
      },
      donationsByMonth: monthly,
      donationsByCity: byCity,
      donationsByCategory: byCategory.map((g) => ({ category: g.category, count: g._count._all })),
      topDonors,
      utilizationRatePercent: utilizationRate(totalQuantityDonated, totalQuantityOffered),
    };
  }

  /**
   * "Disponível perto de mim" antes contava todos os itens da plataforma,
   * ignorando distância apesar do nome. Agora respeita o raio da própria ONG.
   */
  private async countAvailableNearby(organization: {
    notificationRadiusKm: number | null;
    address: { latitude: number; longitude: number };
  }) {
    const radiusKm =
      organization.notificationRadiusKm ?? this.config.get<number>('notifications.radiusKm') ?? 50;

    const candidates = await this.prisma.donationItem.findMany({
      where: {
        status: DonationItemStatus.AVAILABLE,
        donationList: {
          status: DonationListStatus.OPEN,
          deletedAt: null,
          donorOrganization: { approvalStatus: ApprovalStatus.APPROVED },
        },
        pickupDeadline: { gt: new Date() },
      },
      select: {
        id: true,
        donationList: { select: { donorOrganization: { select: { address: true } } } },
      },
      take: MAX_NEARBY_CANDIDATES,
    });

    return candidates.filter((item) => {
      const address = item.donationList.donorOrganization.address;
      return (
        haversineKm(
          organization.address.latitude,
          organization.address.longitude,
          address.latitude,
          address.longitude,
        ) <= radiusKm
      );
    }).length;
  }

  private async monthlySeries(donorOrganizationId?: string): Promise<MonthlyRow[]> {
    const since = monthsAgo(MONTHS_BACK);
    // Doação cancelada não conta como doada; o que dela já tinha sido retirado
    // antes do cancelamento, sim (a quantidade vem da reserva concluída).
    const rows = await this.prisma.$queryRaw<{ month: string; count: number; quantity: number }[]>`
      SELECT to_char(date_trunc('month', di."createdAt"), 'YYYY-MM') AS month,
             COUNT(DISTINCT di.id) FILTER (WHERE di.status <> 'CANCELLED')::int AS count,
             COALESCE(SUM(CASE WHEN r.status = 'COMPLETED' THEN ri.quantity ELSE 0 END), 0)::float8 AS quantity
      FROM donation_items di
      JOIN donation_lists dl ON dl.id = di."donationListId"
      LEFT JOIN reservation_items ri ON ri."donationItemId" = di.id
      LEFT JOIN reservations r ON r.id = ri."reservationId"
      WHERE dl."deletedAt" IS NULL
        AND di."createdAt" >= ${since}
        AND (${donorOrganizationId ?? null}::text IS NULL OR dl."donorOrganizationId" = ${donorOrganizationId ?? null}::text)
      GROUP BY 1`;

    const byMonth = new Map(rows.map((r) => [r.month, r]));
    return lastNMonthKeys(MONTHS_BACK).map((month) => byMonth.get(month) ?? { month, count: 0, quantity: 0 });
  }

  private toStatusTotals(groups: { status: DonationItemStatus; _count: { _all: number } }[]) {
    const totals: Record<DonationItemStatus, number> = {
      AVAILABLE: 0,
      FULLY_RESERVED: 0,
      CANCELLED: 0,
      EXPIRED: 0,
    };
    for (const group of groups) totals[group.status] = group._count._all;
    return totals;
  }

  private emptyDonorDashboard() {
    return {
      totals: this.toStatusTotals([]),
      completedPickups: 0,
      totalQuantityDonated: 0,
      totalQuantityOffered: 0,
      utilizationRatePercent: 0,
      monthly: lastNMonthKeys(MONTHS_BACK).map((month) => ({ month, count: 0, quantity: 0 })),
      recentHistory: [] as unknown[],
    };
  }
}
