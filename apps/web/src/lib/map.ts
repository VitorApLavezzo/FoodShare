import { api } from './api';
import type { DonationCategory } from './donations';

export interface MapOrganization {
  id: string;
  tradeName: string;
  type: string | null;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  distanceKm: number | null;
}

export interface MapDonationItem {
  id: string;
  foodName: string;
  category: DonationCategory;
  remainingQuantity: number;
  unit: string;
}

export interface MapDonation {
  id: string;
  allowPartial: boolean;
  items: MapDonationItem[];
  pickupDeadline: string;
  expiresAt: string;
  donorId: string;
  donorName: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  distanceKm: number | null;
}

/** Alcance das doações de um doador: quantas ONGs recebem o alerta, por cidade. */
export interface MapReach {
  defaultRadiusKm: number;
  totalNgos: number;
  byCity: { city: string; state: string; count: number }[];
}

export interface DistanceFilters {
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export interface MapFilters extends DistanceFilters {
  category?: string;
}

// Só distância: a API recusa parâmetro desconhecido, e mandar `category` aqui
// fazia doadores e ONGs sumirem do mapa (erro 400) ao filtrar por categoria.
export const fetchMapDonors = (params: DistanceFilters = {}) =>
  api.get<MapOrganization[]>('/map/donors', { params }).then((r) => r.data);

export const fetchMapNgos = (params: DistanceFilters = {}) =>
  api.get<MapOrganization[]>('/map/ngos', { params }).then((r) => r.data);

export const fetchMapReach = () => api.get<MapReach>('/map/reach').then((r) => r.data);

export const fetchMapDonations = (params: MapFilters = {}) =>
  api.get<MapDonation[]>('/map/donations', { params }).then((r) => r.data);
