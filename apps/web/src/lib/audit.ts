import { api } from './api';

export interface AuditLogEntry {
  id: string;
  entity: string;
  entityId: string;
  eventType: string;
  userId?: string | null;
  nodeId: string;
  createdAt: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export const fetchAuditLogs = () => api.get<AuditLogPage>('/audit-logs').then((r) => r.data);
