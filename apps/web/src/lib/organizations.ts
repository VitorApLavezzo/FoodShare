import { api } from './api';

export interface Address {
  street: string;
  number?: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  latitude: number;
  longitude: number;
}

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'BLOCKED';

export interface Organization {
  id: string;
  kind: 'DONOR' | 'NGO';
  legalName: string;
  tradeName: string;
  document: string;
  type?: 'RESTAURANT' | 'MARKET' | 'BAKERY' | 'OTHER' | null;
  phone: string;
  email: string;
  responsibleName: string;
  description?: string | null;
  operatingHours?: string | null;
  estimatedCapacity?: number | null;
  approvalStatus: ApprovalStatus;
  address: Address;
}

export interface CreateOrganizationInput {
  legalName: string;
  tradeName: string;
  document: string;
  type?: 'RESTAURANT' | 'MARKET' | 'BAKERY' | 'OTHER';
  phone: string;
  email: string;
  responsibleName: string;
  description?: string;
  operatingHours?: string;
  estimatedCapacity?: number;
  address: Address;
}

const basePathFor = (kind: 'DONOR' | 'NGO') => (kind === 'DONOR' ? '/donors' : '/ngos');

export async function fetchMyOrganization(kind: 'DONOR' | 'NGO'): Promise<Organization | null> {
  const { data } = await api.get<Organization[]>(basePathFor(kind));
  return data[0] ?? null;
}

export async function createOrganization(kind: 'DONOR' | 'NGO', input: CreateOrganizationInput) {
  const { data } = await api.post<Organization>(basePathFor(kind), input);
  return data;
}

export async function updateOrganization(kind: 'DONOR' | 'NGO', id: string, input: CreateOrganizationInput) {
  const { data } = await api.put<Organization>(`${basePathFor(kind)}/${id}`, input);
  return data;
}
