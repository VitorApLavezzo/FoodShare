import { api } from './api';
import type { UserRole } from '@foodshare/types';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  deactivatedReason?: string | null;
  emailVerifiedAt?: string | null;
  createdAt: string;
  organizationLinks: { organization: { tradeName: string; kind: 'DONOR' | 'NGO' } }[];
}

export interface AdminUsersPage {
  items: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchAdminUsers(params: { search?: string; page?: number } = {}) {
  const { data } = await api.get<AdminUsersPage>('/admin/users', { params });
  return data;
}

export async function updateUserStatus(id: string, isActive: boolean, reason?: string) {
  const { data } = await api.patch<AdminUser>(`/admin/users/${id}/status`, { isActive, reason });
  return data;
}
