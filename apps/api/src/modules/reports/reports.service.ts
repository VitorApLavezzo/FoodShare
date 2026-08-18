import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DonationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

const COMPLETED_STATUSES: DonationStatus[] = [DonationStatus.PICKED_UP, DonationStatus.DISTRIBUTED];

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private buildWhere(query: ReportQueryDto): Prisma.DonationWhereInput {
    const where: Prisma.DonationWhereInput = { deletedAt: null };

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.donorOrganizationId) where.donorOrganizationId = query.donorOrganizationId;

    const donorOrganizationWhere: Prisma.OrganizationWhereInput = {};
    if (query.city) donorOrganizationWhere.address = { city: { equals: query.city, mode: 'insensitive' } };
    if (Object.keys(donorOrganizationWhere).length > 0) where.donorOrganization = donorOrganizationWhere;

    if (query.ngoOrganizationId) {
      where.reservations = { some: { ngoOrganizationId: query.ngoOrganizationId } };
    }

    return where;
  }

  async findDonationsReport(query: ReportQueryDto) {
    const donations = await this.prisma.donation.findMany({
      where: this.buildWhere(query),
      include: {
        donorOrganization: { include: { address: true } },
        reservations: { include: { ngoOrganization: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    return donations.map((d) => ({
      donationId: d.id,
      foodName: d.foodName,
      category: d.category,
      quantity: d.quantity,
      unit: d.unit,
      status: d.status,
      donorName: d.donorOrganization.tradeName,
      donorCity: d.donorOrganization.address.city,
      donorState: d.donorOrganization.address.state,
      ngoName: d.reservations[0]?.ngoOrganization.tradeName ?? '',
      createdAt: d.createdAt.toISOString(),
      pickupDeadline: d.pickupDeadline.toISOString(),
      expiresAt: d.expiresAt.toISOString(),
    }));
  }

  async getImpactReport(query: ReportQueryDto) {
    const donations = await this.prisma.donation.findMany({
      where: this.buildWhere(query),
      include: { donorOrganization: { include: { address: true } } },
    });

    const completed = donations.filter((d) => COMPLETED_STATUSES.includes(d.status));
    const totalQuantityDistributed = completed.reduce((sum, d) => sum + d.quantity, 0);

    const byCity = new Map<string, { city: string; donations: number; quantity: number }>();
    for (const d of completed) {
      const city = d.donorOrganization.address.city;
      const entry = byCity.get(city) ?? { city, donations: 0, quantity: 0 };
      entry.donations += 1;
      entry.quantity += d.quantity;
      byCity.set(city, entry);
    }

    return {
      totalDonations: donations.length,
      totalCompleted: completed.length,
      totalExpired: donations.filter((d) => d.status === DonationStatus.EXPIRED).length,
      totalCancelled: donations.filter((d) => d.status === DonationStatus.CANCELLED).length,
      totalQuantityDistributed,
      impactByRegion: [...byCity.values()].sort((a, b) => b.quantity - a.quantity),
    };
  }
}
