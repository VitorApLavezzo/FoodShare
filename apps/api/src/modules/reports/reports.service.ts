import { Injectable } from '@nestjs/common';
import { DonationItemStatus, Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';

const MAX_REPORT_ROWS = 5000;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Unidade do relatório é o item (não a lista) - reflete o que de fato foi
  // ofertado/distribuído, já que uma lista pode ter itens com destinos distintos.
  //
  // Item cancelado pelo doador fica de fora: a doação não aconteceu, e contá-la
  // inflava o total ofertado (o histórico dela continua na auditoria). Só a
  // soma do que foi entregue o inclui — se uma parte já tinha sido retirada
  // antes do cancelamento, aquela comida chegou a quem precisava.
  private buildWhere(
    query: ReportQueryDto,
    { includeCancelled = false }: { includeCancelled?: boolean } = {},
  ): Prisma.DonationItemWhereInput {
    const where: Prisma.DonationItemWhereInput = { donationList: { deletedAt: null } };

    if (query.startDate || query.endDate) {
      where.createdAt = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    else if (!includeCancelled) where.status = { not: DonationItemStatus.CANCELLED };

    const donationListWhere: Prisma.DonationListWhereInput = { deletedAt: null };
    if (query.donorOrganizationId) donationListWhere.donorOrganizationId = query.donorOrganizationId;
    if (query.city) {
      donationListWhere.donorOrganization = {
        address: { city: { equals: query.city, mode: 'insensitive' } },
      };
    }
    where.donationList = donationListWhere;

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
      take: MAX_REPORT_ROWS,
    });

    return items.map((item) => ({
      donationId: item.id,
      foodName: item.foodName,
      category: item.category,
      quantity: item.quantity.toNumber(),
      unit: item.unit,
      status: item.status,
      donorName: item.donationList.donorOrganization.tradeName,
      donorCity: item.donationList.donorOrganization.address.city,
      donorState: item.donationList.donorOrganization.address.state,
      ngoName: item.reservationItems[0]?.reservation.ngoOrganization.tradeName ?? '',
      createdAt: item.createdAt.toISOString(),
      pickupDeadline: item.pickupDeadline.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
    }));
  }

  /**
   * Agregado em SQL em vez de carregar todos os itens na memória. Expirado e
   * cancelado continuam distintos no banco, mas cancelado não entra mais no
   * relatório (ver `buildWhere`).
   */
  async getImpactReport(query: ReportQueryDto) {
    const where = this.buildWhere(query);

    const [statusGroups, totalDonations, delivered, byRegion] = await Promise.all([
      this.prisma.donationItem.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.donationItem.count({ where }),
      this.prisma.reservationItem.aggregate({
        where: {
          reservation: { status: ReservationStatus.COMPLETED },
          donationItem: this.buildWhere(query, { includeCancelled: true }),
        },
        _sum: { quantity: true },
      }),
      this.prisma.$queryRaw<{ city: string; donations: number; quantity: number }[]>`
        SELECT a.city,
               COUNT(DISTINCT di.id)::int AS donations,
               COALESCE(SUM(ri.quantity), 0)::float8 AS quantity
        FROM reservation_items ri
        JOIN reservations r ON r.id = ri."reservationId" AND r.status = 'COMPLETED'
        JOIN donation_items di ON di.id = ri."donationItemId"
        JOIN donation_lists dl ON dl.id = di."donationListId" AND dl."deletedAt" IS NULL
        JOIN organizations o ON o.id = dl."donorOrganizationId"
        JOIN addresses a ON a.id = o."addressId"
        GROUP BY a.city
        ORDER BY quantity DESC`,
    ]);

    const countFor = (status: DonationItemStatus) =>
      statusGroups.find((g) => g.status === status)?._count._all ?? 0;

    return {
      totalDonations,
      totalCompleted: countFor(DonationItemStatus.FULLY_RESERVED),
      totalExpired: countFor(DonationItemStatus.EXPIRED),
      totalQuantityDistributed: delivered._sum.quantity?.toNumber() ?? 0,
      impactByRegion: byRegion,
    };
  }
}
