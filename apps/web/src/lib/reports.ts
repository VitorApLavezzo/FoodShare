import { api } from './api';

export interface DonationReportRow {
  donationId: string;
  foodName: string;
  category: string;
  quantity: number;
  unit: string;
  status: string;
  donorName: string;
  donorCity: string;
  donorState: string;
  ngoName: string;
  createdAt: string;
  pickupDeadline: string;
  expiresAt: string;
}

export interface ImpactReport {
  totalDonations: number;
  totalCompleted: number;
  totalExpired: number;
  totalCancelled: number;
  totalQuantityDistributed: number;
  estimatedPeopleServed: number;
  impactByRegion: { city: string; donations: number; quantity: number }[];
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  city?: string;
  category?: string;
  status?: string;
}

export const fetchDonationsReport = (filters: ReportFilters) =>
  api.get<DonationReportRow[]>('/reports/donations', { params: filters }).then((r) => r.data);

export const fetchImpactReport = (filters: ReportFilters) =>
  api.get<ImpactReport>('/reports/impact', { params: filters }).then((r) => r.data);

export async function downloadDonationsCsv(filters: ReportFilters) {
  const response = await api.get('/reports/donations', {
    params: { ...filters, format: 'csv' },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'doacoes.csv';
  link.click();
  URL.revokeObjectURL(url);
}
