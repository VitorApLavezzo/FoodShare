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

export interface MapDonation {
  id: string;
  foodName: string;
  category: DonationCategory;
  quantity: number;
  unit: string;
  pickupDeadline: string;
  expiresAt: string;
  donorName: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  distanceKm: number | null;
}

export interface MapFilters {
  lat?: number;
  lng?: number;
  radiusKm?: number;
  category?: string;
}

export const fetchMapDonors = (params: MapFilters = {}) =>
  api.get<MapOrganization[]>('/map/donors', { params }).then((r) => r.data);

export const fetchMapNgos = (params: MapFilters = {}) =>
  api.get<MapOrganization[]>('/map/ngos', { params }).then((r) => r.data);

export const fetchMapDonations = (params: MapFilters = {}) =>
  api.get<MapDonation[]>('/map/donations', { params }).then((r) => r.data);
