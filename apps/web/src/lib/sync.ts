import { api } from './api';

export interface SyncStatus {
  pending: number;
  synced: number;
  failed: number;
  lastSynced: { syncedAt: string; originNode: string; eventType: string } | null;
}

export interface SyncEventEntry {
  id: string;
  eventId: string;
  originNode: string;
  sequence: string;
  eventType: string;
  entityId: string;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  errorMessage: string | null;
  createdAt: string;
  syncedAt: string | null;
}

export const fetchSyncStatus = () => api.get<SyncStatus>('/sync/status').then((r) => r.data);
export const fetchSyncEvents = () => api.get<SyncEventEntry[]>('/sync/events').then((r) => r.data);
