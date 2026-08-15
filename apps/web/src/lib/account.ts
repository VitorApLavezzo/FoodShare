import { api } from './api';
import type { AuthUser } from '../context/AuthContext';

export async function updateProfile(name: string) {
  const { data } = await api.patch<AuthUser>('/users/me', { name });
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await api.post<{ success: boolean }>('/users/me/change-password', {
    currentPassword,
    newPassword,
  });
  return data;
}
