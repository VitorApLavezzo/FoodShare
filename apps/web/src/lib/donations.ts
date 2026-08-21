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

export type DonationListStatus = 'OPEN' | 'FULLY_RESERVED' | 'CANCELLED' | 'CLOSED';
export type DonationItemStatus = 'AVAILABLE' | 'FULLY_RESERVED' | 'CANCELLED';

export interface DonationItem {
  id: string;
  foodName: string;
  category: DonationCategory;
  description?: string | null;
  quantity: number;
  remainingQuantity: number;
  unit: string;
  status: DonationItemStatus;
}

export interface DonationList {
  id: string;
  allowPartial: boolean;
  status: DonationListStatus;
  notes?: string | null;
  availableAt: string;
  pickupDeadline: string;
  expiresAt: string;
  items: DonationItem[];
  donorOrganization?: {
    tradeName: string;
    address: { city: string; state: string };
  };
}

export interface CreateDonationItemInput {
  foodName: string;
  category: DonationCategory;
  description?: string;
  quantity: number;
  unit: string;
  batch?: string;
  storageCondition?: string;
}

export interface CreateDonationListInput {
  items: CreateDonationItemInput[];
  allowPartial: boolean;
  notes?: string;
  availableAt: string;
  pickupDeadline: string;
  expiresAt: string;
}

export interface UpdateDonationListInput {
  notes?: string;
  availableAt?: string;
  pickupDeadline?: string;
  expiresAt?: string;
}

export interface DonationListsPage {
  items: DonationList[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchDonations(params: { category?: string; search?: string } = {}) {
  const { data } = await api.get<DonationListsPage>('/donations', { params });
  return data;
}

export async function createDonation(input: CreateDonationListInput) {
  const { data } = await api.post<DonationList>('/donations', input);
  return data;
}

export async function updateDonation(id: string, input: UpdateDonationListInput) {
  const { data } = await api.put<DonationList>(`/donations/${id}`, input);
  return data;
}

export async function cancelDonation(id: string) {
  const { data } = await api.delete<DonationList>(`/donations/${id}`);
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

export const DONATION_LIST_STATUS_LABEL: Record<DonationListStatus, string> = {
  OPEN: 'Disponível',
  FULLY_RESERVED: 'Totalmente reservada',
  CANCELLED: 'Cancelada',
  CLOSED: 'Encerrada',
};

export const DONATION_ITEM_STATUS_LABEL: Record<DonationItemStatus, string> = {
  AVAILABLE: 'Disponível',
  FULLY_RESERVED: 'Reservado',
  CANCELLED: 'Cancelado',
};
