import { api } from './api';

export interface NodeInfo {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  lastHeartbeat: string | null;
  pendingEvents: number;
}

export const fetchNodes = () => api.get<NodeInfo[]>('/nodes').then((r) => r.data);
