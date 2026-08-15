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
  document?: string | null;
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
  document?: string;
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

/** Admin-only: retorna todas as organizações do tipo (não só as do usuário atual). */
export async function fetchAllOrganizations(kind: 'DONOR' | 'NGO'): Promise<Organization[]> {
  const { data } = await api.get<Organization[]>(basePathFor(kind));
  return data;
}

export async function updateApproval(
  kind: 'DONOR' | 'NGO',
  id: string,
  status: 'APPROVED' | 'REJECTED' | 'BLOCKED',
) {
  const { data } = await api.patch<Organization>(`${basePathFor(kind)}/${id}/approval`, { status });
  return data;
}

export async function createOrganization(kind: 'DONOR' | 'NGO', input: CreateOrganizationInput) {
  const { data } = await api.post<Organization>(basePathFor(kind), input);
  return data;
}

export async function updateOrganization(kind: 'DONOR' | 'NGO', id: string, input: CreateOrganizationInput) {
  const { data } = await api.put<Organization>(`${basePathFor(kind)}/${id}`, input);
  return data;
}
