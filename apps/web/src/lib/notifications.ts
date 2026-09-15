import { api } from './api';

import type { NotificationType } from '@foodshare/types';
export type { NotificationType };

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  readAt?: string | null;
  donationListId?: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchNotifications(unreadOnly = false) {
  const { data } = await api.get<NotificationsPage>('/notifications', { params: { unreadOnly } });
  return data;
}

export async function markNotificationRead(id: string) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data;
}

export async function deleteNotification(id: string) {
  const { data } = await api.delete(`/notifications/${id}`);
  return data;
}

export async function clearNotifications() {
  const { data } = await api.delete('/notifications');
  return data;
}
