import {
  DONATION_CATEGORY_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  DONATION_LIST_STATUS_LABEL,
  type DonationCategory,
  type DonationItemStatus,
  type DonationListStatus,
} from '@foodshare/types';
import { api } from './api';

// Reexporta para os componentes não precisarem saber de onde vêm os enums.
export {
  DONATION_CATEGORY_LABEL as CATEGORY_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  DONATION_LIST_STATUS_LABEL,
};
export type { DonationCategory, DonationItemStatus, DonationListStatus };

export interface DonationItem {
  id: string;
  foodName: string;
  category: DonationCategory;
  description?: string | null;
  quantity: number;
  remainingQuantity: number;
  unit: string;
  status: DonationItemStatus;
  imageUrl?: string | null;
  allergens?: string | null;
  storageCondition?: string | null;
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
    completedPickupCount?: number;
    noShowCount?: number;
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
  imageUrl?: string;
  allergens?: string;
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

export async function fetchDonations(
  params: { category?: string; search?: string; city?: string; page?: number; limit?: number } = {},
) {
  const { data } = await api.get<DonationListsPage>('/donations', { params });
  return data;
}

export async function fetchDonation(id: string) {
  const { data } = await api.get<DonationList>(`/donations/${id}`);
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


/** Envia a foto do alimento e devolve a URL pública para anexar ao item. */
export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<{ url: string }>('/uploads/images', formData);
  return data.url;
}
