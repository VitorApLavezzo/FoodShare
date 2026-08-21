import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DonationItemStatus, DonationListStatus, OrganizationKind, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const MONTHS_BACK = 6;

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastNMonthKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getDonorDashboard(user: AuthenticatedUser) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organization: { kind: OrganizationKind.DONOR } },
    });

    if (!link) {
      return this.emptyDashboard();
    }

    const items = await this.prisma.donationItem.findMany({
      where: { donationList: { donorOrganizationId: link.organizationId, deletedAt: null } },
      include: { reservationItems: { include: { reservation: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const totals = this.countByStatus(items);
    const totalQuantityDonated = items.reduce((sum, item) => sum + this.completedQuantity(item), 0);

    return {
      totals,
      totalQuantityDonated,
      monthly: this.buildMonthlySeries(
        items.map((item) => ({ createdAt: item.createdAt, quantity: this.completedQuantity(item) })),
      ),
      recentHistory: items.slice(0, 10).map((item) => ({
        id: item.id,
        foodName: item.foodName,
        status: item.status,
        quantity: item.quantity,
        unit: item.unit,
        updatedAt: item.updatedAt,
      })),
    };
  }

  async getNgoDashboard(user: AuthenticatedUser) {
    const link = await this.prisma.organizationUser.findFirst({
      where: { userId: user.id, organization: { kind: OrganizationKind.NGO } },
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

    const [availableNearby, reservationItems] = await Promise.all([
      this.prisma.donationItem.count({
        where: {
          status: DonationItemStatus.AVAILABLE,
          donationList: { status: DonationListStatus.OPEN, expiresAt: { gt: new Date() }, deletedAt: null },
        },
      }),
      this.prisma.reservationItem.findMany({
        where: { reservation: { ngoOrganizationId: link.organizationId } },
        include: { reservation: true, donationItem: true },
        orderBy: { id: 'desc' },
      }),
    ]);

    const activeReservations = new Set(
      reservationItems.filter((ri) => ri.reservation.status === ReservationStatus.ACTIVE).map((ri) => ri.reservationId),
    ).size;
    const completed = reservationItems.filter((ri) => ri.reservation.status === ReservationStatus.COMPLETED);
    const totalQuantityReceived = completed.reduce((sum, ri) => sum + ri.quantity, 0);

    return {
      availableNearby,
      activeReservations,
      completedPickups: new Set(completed.map((ri) => ri.reservationId)).size,
      totalQuantityReceived,
      recentHistory: reservationItems.slice(0, 10).map((ri) => ({
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
    const [donorCount, ngoCount, items, nodes] = await Promise.all([
      this.prisma.organization.count({ where: { kind: OrganizationKind.DONOR, deletedAt: null } }),
      this.prisma.organization.count({ where: { kind: OrganizationKind.NGO, deletedAt: null } }),
      this.prisma.donationItem.findMany({
        where: { donationList: { deletedAt: null } },
        include: {
          donationList: { include: { donorOrganization: { include: { address: true } } } },
          reservationItems: { include: { reservation: true } },
        },
      }),
      this.prisma.node.findMany(),
    ]);

    const totals = this.countByStatus(items);
    const totalQuantityDonated = items.reduce((sum, item) => sum + this.completedQuantity(item), 0);
    const completedCount = items.filter((item) => this.completedQuantity(item) > 0).length;

    const now = Date.now();
    const nodesOnline = nodes.filter(
      (n) => n.lastHeartbeat && now - n.lastHeartbeat.getTime() < 45_000,
    ).length;

    const byCity = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byDonor = new Map<string, { name: string; count: number }>();
    for (const item of items) {
      const city = item.donationList.donorOrganization.address.city;
      byCity.set(city, (byCity.get(city) ?? 0) + 1);
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
      const key = item.donationList.donorOrganizationId;
      const entry = byDonor.get(key) ?? { name: item.donationList.donorOrganization.tradeName, count: 0 };
      entry.count += 1;
      byDonor.set(key, entry);
    }

    const settledCount = items.filter(
      (item) => item.status === DonationItemStatus.CANCELLED || item.status === DonationItemStatus.FULLY_RESERVED,
    ).length;
    const utilizationRate = settledCount === 0 ? 0 : Math.round((completedCount / settledCount) * 1000) / 10;

    return {
      totals: {
        donors: donorCount,
        ngos: ngoCount,
        donationsAvailable: totals.AVAILABLE,
        donationsCompleted: completedCount,
        donationsExpired: 0,
        totalQuantityDonated,
        nodesOnline,
        nodesTotal: nodes.length,
      },
      donationsByMonth: this.buildMonthlySeries(
        items.map((item) => ({ createdAt: item.createdAt, quantity: this.completedQuantity(item) })),
      ),
      donationsByCity: [...byCity.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count),
      donationsByCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
      topDonors: [...byDonor.values()].sort((a, b) => b.count - a.count).slice(0, 5),
      utilizationRatePercent: utilizationRate,
    };
  }

  private completedQuantity(item: {
    reservationItems: { quantity: number; reservation: { status: ReservationStatus } }[];
  }) {
    return item.reservationItems
      .filter((ri) => ri.reservation.status === ReservationStatus.COMPLETED)
      .reduce((sum, ri) => sum + ri.quantity, 0);
  }

  private countByStatus(items: { status: DonationItemStatus }[]) {
    const totals: Record<DonationItemStatus, number> = {
      AVAILABLE: 0,
      FULLY_RESERVED: 0,
      CANCELLED: 0,
    };
    for (const item of items) totals[item.status] += 1;
    return totals;
  }

  private buildMonthlySeries(items: { createdAt: Date; quantity: number }[]) {
    const keys = lastNMonthKeys(MONTHS_BACK);
    const buckets = new Map(keys.map((k) => [k, { month: k, count: 0, quantity: 0 }]));
    for (const item of items) {
      const key = monthKey(item.createdAt);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.quantity += item.quantity;
      }
    }
    return keys.map((k) => buckets.get(k)!);
  }

  private emptyDashboard() {
    return {
      totals: this.countByStatus([]),
      totalQuantityDonated: 0,
      monthly: this.buildMonthlySeries([]),
      recentHistory: [] as unknown[],
    };
  }
}
