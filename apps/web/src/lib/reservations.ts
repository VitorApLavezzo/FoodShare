import { api } from './api';
import type { DonationList } from './donations';

export type ReservationStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED';

export interface ReservationItem {
  id: string;
  donationItemId: string;
  quantity: number;
  donationItem?: { foodName: string; unit: string };
}

export interface Reservation {
  id: string;
  donationListId: string;
  status: ReservationStatus;
  reservedAt: string;
  cancelledAt?: string | null;
  pickupCode: string;
  donationList: DonationList;
  items: ReservationItem[];
  conversationId?: string;
}

export interface ReserveItemInput {
  donationItemId: string;
  quantity?: number;
}

export async function reserveDonationItems(donationListId: string, items: ReserveItemInput[]) {
  const { data } = await api.post<Reservation>('/reservations', { donationListId, items });
  return data;
}

export async function cancelReservation(reservationId: string) {
  const { data } = await api.post<Reservation>(`/reservations/${reservationId}/cancel`);
  return data;
}

export async function fetchReservations() {
  const { data } = await api.get<Reservation[]>('/reservations');
  return data;
}

export async function confirmPickup(pickupCode: string) {
  const { data } = await api.post('/reservations/confirm-pickup', { pickupCode });
  return data;
}
