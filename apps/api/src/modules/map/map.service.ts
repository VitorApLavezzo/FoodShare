import { Injectable } from '@nestjs/common';
import { ApprovalStatus, DonationCategory, DonationListStatus, OrganizationKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { haversineKm } from '../../common/geo';

// Teto de segurança para o cálculo de distância em memória (ver decisão de
// arquitetura da Fase 8: sem PostGIS, sem SQL geoespacial — aceitável no
// volume de dados atual do projeto).
const MAX_CANDIDATES = 500;

interface DistanceParams {
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrganizations(kind: OrganizationKind, params: DistanceParams) {
    const organizations = await this.prisma.organization.findMany({
      where: { kind, approvalStatus: ApprovalStatus.APPROVED, deletedAt: null },
      include: { address: true },
    });

    return this.withDistance(
      organizations.map((org) => ({
        id: org.id,
        tradeName: org.tradeName,
        type: org.type,
        latitude: org.address.latitude,
        longitude: org.address.longitude,
        city: org.address.city,
        state: org.address.state,
      })),
      params,
    );
  }

  async findAvailableDonations(
    params: DistanceParams & { category?: DonationCategory; minQuantity?: number },
  ) {
    const donationLists = await this.prisma.donationList.findMany({
      where: {
        status: DonationListStatus.OPEN,
        expiresAt: { gt: new Date() },
        deletedAt: null,
        donorOrganization: { approvalStatus: ApprovalStatus.APPROVED },
        items: {
          some: {
            status: 'AVAILABLE',
            category: params.category,
            remainingQuantity: params.minQuantity ? { gte: params.minQuantity } : undefined,
          },
        },
      },
      include: { donorOrganization: { include: { address: true } }, items: true },
      take: MAX_CANDIDATES,
      orderBy: { expiresAt: 'asc' },
    });

    return this.withDistance(
      donationLists.map((list) => ({
        id: list.id,
        allowPartial: list.allowPartial,
        items: list.items.map((item) => ({
          id: item.id,
          foodName: item.foodName,
          category: item.category,
          remainingQuantity: item.remainingQuantity,
          unit: item.unit,
        })),
        pickupDeadline: list.pickupDeadline,
        expiresAt: list.expiresAt,
        donorName: list.donorOrganization.tradeName,
        latitude: list.donorOrganization.address.latitude,
        longitude: list.donorOrganization.address.longitude,
        city: list.donorOrganization.address.city,
        state: list.donorOrganization.address.state,
      })),
      params,
    );
  }

  /**
   * Calcula a distância (Haversine) a partir de lat/lng informados, filtra por raio
   * quando fornecido, e ordena por proximidade. Sem lat/lng, apenas retorna a lista.
   */
  private withDistance<T extends { latitude: number; longitude: number }>(
    items: T[],
    { lat, lng, radiusKm }: DistanceParams,
  ): (T & { distanceKm: number | null })[] {
    if (lat === undefined || lng === undefined) {
      return items.map((item) => ({ ...item, distanceKm: null }));
    }

    const withDistance = items.map((item) => ({
      ...item,
      distanceKm: Math.round(haversineKm(lat, lng, item.latitude, item.longitude) * 10) / 10,
    }));

    const filtered = radiusKm ? withDistance.filter((item) => item.distanceKm <= radiusKm) : withDistance;
    return filtered.sort((a, b) => a.distanceKm - b.distanceKm);
  }
}
