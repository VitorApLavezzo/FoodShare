import { api } from './api';

export type DonationCategory =
  | 'PREPARED_MEALS'
  | 'FRUITS'
  | 'VEGETABLES'
  | 'LEGUMES'
  | 'PACKAGED_GOODS'
  | 'BAKERY'
  | 'BEVERAGES'
  | 'OTHER';

export type DonationStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'PICKUP_PENDING'
  | 'PICKED_UP'
  | 'DISTRIBUTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface Donation {
  id: string;
  foodName: string;
  category: DonationCategory;
  description?: string | null;
  quantity: number;
  unit: string;
  availableAt: string;
  pickupDeadline: string;
  expiresAt: string;
  status: DonationStatus;
  donorOrganization?: {
    tradeName: string;
    address: { city: string; state: string };
  };
}

export interface CreateDonationInput {
  foodName: string;
  category: DonationCategory;
  description?: string;
  quantity: number;
  unit: string;
  batch?: string;
  storageCondition?: string;
  notes?: string;
  availableAt: string;
  pickupDeadline: string;
  expiresAt: string;
}

export interface DonationsPage {
  items: Donation[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchDonations(params: { category?: string; search?: string } = {}) {
  const { data } = await api.get<DonationsPage>('/donations', { params });
  return data;
}

export async function createDonation(input: CreateDonationInput) {
  const { data } = await api.post<Donation>('/donations', input);
  return data;
}

export async function cancelDonation(id: string) {
  const { data } = await api.delete<Donation>(`/donations/${id}`);
  return data;
}

export const CATEGORY_LABEL: Record<DonationCategory, string> = {
  PREPARED_MEALS: 'Alimentos preparados',
  FRUITS: 'Frutas',
  VEGETABLES: 'Verduras',
  LEGUMES: 'Legumes',
  PACKAGED_GOODS: 'Produtos industrializados',
  BAKERY: 'Padaria',
  BEVERAGES: 'Bebidas',
  OTHER: 'Outros',
};

export const STATUS_LABEL: Record<DonationStatus, string> = {
  AVAILABLE: 'Disponível',
  RESERVED: 'Reservada',
  PICKUP_PENDING: 'Aguardando retirada',
  PICKED_UP: 'Retirada',
  DISTRIBUTED: 'Distribuída',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
};
