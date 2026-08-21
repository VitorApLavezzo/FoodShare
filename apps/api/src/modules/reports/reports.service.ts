import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DonationItemStatus, Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Unidade do relatório é o item (não a lista) - reflete o que de fato foi
  // ofertado/distribuído, já que uma lista pode ter itens com destinos distintos.
  private buildWhere(query: ReportQueryDto): Prisma.DonationItemWhereInput {
    const where: Prisma.DonationItemWhereInput = { donationList: { deletedAt: null } };

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status as DonationItemStatus;

    const donationListWhere: Prisma.DonationListWhereInput = {};
    if (query.donorOrganizationId) donationListWhere.donorOrganizationId = query.donorOrganizationId;

    const donorOrganizationWhere: Prisma.OrganizationWhereInput = {};
    if (query.city) donorOrganizationWhere.address = { city: { equals: query.city, mode: 'insensitive' } };
    if (Object.keys(donorOrganizationWhere).length > 0) donationListWhere.donorOrganization = donorOrganizationWhere;

    if (Object.keys(donationListWhere).length > 0) where.donationList = donationListWhere;

    if (query.ngoOrganizationId) {
      where.reservationItems = { some: { reservation: { ngoOrganizationId: query.ngoOrganizationId } } };
    }

    return where;
  }

  async findDonationsReport(query: ReportQueryDto) {
    const items = await this.prisma.donationItem.findMany({
      where: this.buildWhere(query),
      include: {
        donationList: { include: { donorOrganization: { include: { address: true } } } },
        reservationItems: {
          include: { reservation: { include: { ngoOrganization: true } } },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    return items.map((item) => ({
      donationId: item.id,
      foodName: item.foodName,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status,
      donorName: item.donationList.donorOrganization.tradeName,
      donorCity: item.donationList.donorOrganization.address.city,
      donorState: item.donationList.donorOrganization.address.state,
      ngoName: item.reservationItems[0]?.reservation.ngoOrganization.tradeName ?? '',
      createdAt: item.createdAt.toISOString(),
      pickupDeadline: item.donationList.pickupDeadline.toISOString(),
      expiresAt: item.donationList.expiresAt.toISOString(),
    }));
  }

  async getImpactReport(query: ReportQueryDto) {
    const items = await this.prisma.donationItem.findMany({
      where: this.buildWhere(query),
      include: {
        donationList: { include: { donorOrganization: { include: { address: true } } } },
        reservationItems: { include: { reservation: true } },
      },
    });

    const byCity = new Map<string, { city: string; donations: number; quantity: number }>();
    let totalQuantityDistributed = 0;
    let totalCompleted = 0;

    for (const item of items) {
      const completedQuantity = item.reservationItems
        .filter((ri) => ri.reservation.status === ReservationStatus.COMPLETED)
        .reduce((sum, ri) => sum + ri.quantity, 0);
      if (completedQuantity <= 0) continue;

      totalCompleted += 1;
      totalQuantityDistributed += completedQuantity;

      const city = item.donationList.donorOrganization.address.city;
      const entry = byCity.get(city) ?? { city, donations: 0, quantity: 0 };
      entry.donations += 1;
      entry.quantity += completedQuantity;
      byCity.set(city, entry);
    }

    return {
      totalDonations: items.length,
      totalCompleted,
      totalExpired: 0,
      totalCancelled: items.filter((item) => item.status === DonationItemStatus.CANCELLED).length,
      totalQuantityDistributed,
      impactByRegion: [...byCity.values()].sort((a, b) => b.quantity - a.quantity),
    };
  }
}
