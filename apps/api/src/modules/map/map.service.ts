import { Injectable } from '@nestjs/common';
import { ApprovalStatus, DonationCategory, DonationStatus, OrganizationKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const EARTH_RADIUS_KM = 6371;
// Teto de segurança para o cálculo de distância em memória (ver decisão de
// arquitetura da Fase 8: sem PostGIS, sem SQL geoespacial — aceitável no
// volume de dados atual do projeto).
const MAX_CANDIDATES = 500;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
    const donations = await this.prisma.donation.findMany({
      where: {
        status: DonationStatus.AVAILABLE,
        expiresAt: { gt: new Date() },
        deletedAt: null,
        category: params.category,
        quantity: params.minQuantity ? { gte: params.minQuantity } : undefined,
        donorOrganization: { approvalStatus: ApprovalStatus.APPROVED },
      },
      include: { donorOrganization: { include: { address: true } } },
      take: MAX_CANDIDATES,
      orderBy: { expiresAt: 'asc' },
    });

    return this.withDistance(
      donations.map((d) => ({
        id: d.id,
        foodName: d.foodName,
        category: d.category,
        quantity: d.quantity,
        unit: d.unit,
        pickupDeadline: d.pickupDeadline,
        expiresAt: d.expiresAt,
        donorName: d.donorOrganization.tradeName,
        latitude: d.donorOrganization.address.latitude,
        longitude: d.donorOrganization.address.longitude,
        city: d.donorOrganization.address.city,
        state: d.donorOrganization.address.state,
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
