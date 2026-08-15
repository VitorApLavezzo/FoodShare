import { api } from './api';
import type { Donation } from './donations';

export type ReservationStatus = 'ACTIVE' | 'CANCELLED' | 'COMPLETED';

export interface Reservation {
  id: string;
  donationId: string;
  status: ReservationStatus;
  reservedAt: string;
  cancelledAt?: string | null;
  pickupCode: string;
  donation: Donation;
}

export async function reserveDonation(donationId: string) {
  const { data } = await api.post<Reservation>(`/donations/${donationId}/reserve`);
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

export async function confirmPickup(donationId: string, pickupCode: string) {
  const { data } = await api.post(`/donations/${donationId}/confirm-pickup`, { pickupCode });
  return data;
}
