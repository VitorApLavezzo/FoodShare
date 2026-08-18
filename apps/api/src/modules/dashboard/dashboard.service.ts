import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DonationStatus, OrganizationKind, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

const MONTHS_BACK = 6;
const COMPLETED_STATUSES: DonationStatus[] = [DonationStatus.PICKED_UP, DonationStatus.DISTRIBUTED];

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

    const donations = await this.prisma.donation.findMany({
      where: { donorOrganizationId: link.organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const totals = this.countByStatus(donations);
    const totalQuantityDonated = donations
      .filter((d) => COMPLETED_STATUSES.includes(d.status))
      .reduce((sum, d) => sum + d.quantity, 0);

    return {
      totals,
      totalQuantityDonated,
      monthly: this.buildMonthlySeries(donations),
      recentHistory: donations.slice(0, 10).map((d) => ({
        id: d.id,
        foodName: d.foodName,
        status: d.status,
        quantity: d.quantity,
        unit: d.unit,
        updatedAt: d.updatedAt,
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

    const [availableNearby, reservations] = await Promise.all([
      this.prisma.donation.count({
        where: { status: DonationStatus.AVAILABLE, expiresAt: { gt: new Date() }, deletedAt: null },
      }),
      this.prisma.reservation.findMany({
        where: { ngoOrganizationId: link.organizationId },
        include: { donation: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const activeReservations = reservations.filter((r) => r.status === ReservationStatus.ACTIVE).length;
    const completed = reservations.filter((r) => r.status === ReservationStatus.COMPLETED);
    const totalQuantityReceived = completed.reduce((sum, r) => sum + r.donation.quantity, 0);

    return {
      availableNearby,
      activeReservations,
      completedPickups: completed.length,
      totalQuantityReceived,
      recentHistory: reservations.slice(0, 10).map((r) => ({
        id: r.id,
        foodName: r.donation.foodName,
        status: r.status,
        quantity: r.donation.quantity,
        unit: r.donation.unit,
        reservedAt: r.reservedAt,
      })),
    };
  }

  async getAdminDashboard() {
    const [donorCount, ngoCount, donations, nodes] = await Promise.all([
      this.prisma.organization.count({ where: { kind: OrganizationKind.DONOR, deletedAt: null } }),
      this.prisma.organization.count({ where: { kind: OrganizationKind.NGO, deletedAt: null } }),
      this.prisma.donation.findMany({
        where: { deletedAt: null },
        include: { donorOrganization: { include: { address: true } } },
      }),
      this.prisma.node.findMany(),
    ]);

    const totals = this.countByStatus(donations);
    const completedDonations = donations.filter((d) => COMPLETED_STATUSES.includes(d.status));
    const totalQuantityDonated = completedDonations.reduce((sum, d) => sum + d.quantity, 0);

    const now = Date.now();
    const nodesOnline = nodes.filter(
      (n) => n.lastHeartbeat && now - n.lastHeartbeat.getTime() < 45_000,
    ).length;

    const byCity = new Map<string, number>();
    const byCategory = new Map<string, number>();
    const byDonor = new Map<string, { name: string; count: number }>();
    for (const d of donations) {
      const city = d.donorOrganization.address.city;
      byCity.set(city, (byCity.get(city) ?? 0) + 1);
      byCategory.set(d.category, (byCategory.get(d.category) ?? 0) + 1);
      const key = d.donorOrganizationId;
      const entry = byDonor.get(key) ?? { name: d.donorOrganization.tradeName, count: 0 };
      entry.count += 1;
      byDonor.set(key, entry);
    }

    const settledStatuses: DonationStatus[] = [
      DonationStatus.PICKED_UP,
      DonationStatus.DISTRIBUTED,
      DonationStatus.EXPIRED,
      DonationStatus.CANCELLED,
    ];
    const settledCount = donations.filter((d) => settledStatuses.includes(d.status)).length;
    const utilizationRate = settledCount === 0 ? 0 : Math.round((completedDonations.length / settledCount) * 1000) / 10;

    return {
      totals: {
        donors: donorCount,
        ngos: ngoCount,
        donationsAvailable: totals.AVAILABLE,
        donationsCompleted: completedDonations.length,
        donationsExpired: totals.EXPIRED,
        totalQuantityDonated,
        nodesOnline,
        nodesTotal: nodes.length,
      },
      donationsByMonth: this.buildMonthlySeries(donations),
      donationsByCity: [...byCity.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count),
      donationsByCategory: [...byCategory.entries()].map(([category, count]) => ({ category, count })),
      topDonors: [...byDonor.values()].sort((a, b) => b.count - a.count).slice(0, 5),
      utilizationRatePercent: utilizationRate,
    };
  }

  private countByStatus(donations: { status: DonationStatus }[]) {
    const totals: Record<DonationStatus, number> = {
      AVAILABLE: 0,
      RESERVED: 0,
      PICKUP_PENDING: 0,
      PICKED_UP: 0,
      DISTRIBUTED: 0,
      EXPIRED: 0,
      CANCELLED: 0,
    };
    for (const d of donations) totals[d.status] += 1;
    return totals;
  }

  private buildMonthlySeries(donations: { createdAt: Date; quantity: number }[]) {
    const keys = lastNMonthKeys(MONTHS_BACK);
    const buckets = new Map(keys.map((k) => [k, { month: k, count: 0, quantity: 0 }]));
    for (const d of donations) {
      const key = monthKey(d.createdAt);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.count += 1;
        bucket.quantity += d.quantity;
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
