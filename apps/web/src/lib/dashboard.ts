import { api } from './api';

export interface DonorDashboard {
  totals: Partial<Record<'AVAILABLE' | 'FULLY_RESERVED' | 'CANCELLED' | 'EXPIRED', number>>;
  completedPickups: number;
  totalQuantityDonated: number;
  monthly: { month: string; count: number; quantity: number }[];
  recentHistory: {
    id: string;
    foodName: string;
    status: string;
    quantity: number;
    unit: string;
    updatedAt: string;
  }[];
}

export interface NgoDashboard {
  availableNearby: number;
  activeReservations: number;
  completedPickups: number;
  totalQuantityReceived: number;
  recentHistory: {
    id: string;
    foodName: string;
    status: string;
    quantity: number;
    unit: string;
    reservedAt: string;
  }[];
}

export interface AdminDashboard {
  totals: {
    donors: number;
    ngos: number;
    donationsAvailable: number;
    donationsCompleted: number;
    donationsExpired: number;
    totalQuantityDonated: number;
    nodesOnline: number;
    nodesTotal: number;
  };
  donationsByMonth: { month: string; count: number; quantity: number }[];
  donationsByCity: { city: string; count: number }[];
  donationsByCategory: { category: string; count: number }[];
  topDonors: { name: string; count: number }[];
  utilizationRatePercent: number;
}

export const fetchDonorDashboard = () => api.get<DonorDashboard>('/dashboard/donor').then((r) => r.data);
export const fetchNgoDashboard = () => api.get<NgoDashboard>('/dashboard/ngo').then((r) => r.data);
export const fetchAdminDashboard = () => api.get<AdminDashboard>('/dashboard/admin').then((r) => r.data);
