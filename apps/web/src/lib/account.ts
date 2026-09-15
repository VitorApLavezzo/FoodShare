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

export interface MessageResponse {
  message: string;
}

export async function requestPasswordReset(email: string) {
  const { data } = await api.post<MessageResponse>('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(token: string, password: string) {
  const { data } = await api.post<MessageResponse>('/auth/reset-password', { token, password });
  return data;
}

export async function verifyEmail(token: string) {
  const { data } = await api.post<MessageResponse>('/auth/verify-email', { token });
  return data;
}

export async function resendVerification() {
  const { data } = await api.post<MessageResponse>('/auth/resend-verification');
  return data;
}

/** LGPD: baixa um JSON com tudo que a plataforma guarda sobre o usuário. */
export async function downloadMyData() {
  const { data } = await api.get('/users/me/export');
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'meus-dados-foodshare.json';
  link.click();
  URL.revokeObjectURL(url);
}

export async function deleteMyAccount() {
  const { data } = await api.delete<MessageResponse>('/users/me');
  return data;
}
