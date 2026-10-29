import { api } from './api';
import type { CreateDonationItemInput } from './donations';

export type DonationRecurrence = 'DAILY' | 'WEEKDAYS' | 'WEEKLY';

// As datas da doação gerada saem da janela do modelo (pickupWindowHours e
// expiresInHours), não de cada item.
type TemplateItem = Omit<CreateDonationItemInput, 'pickupDeadline' | 'expiresAt'>;

export const RECURRENCE_LABEL: Record<DonationRecurrence, string> = {
  DAILY: 'Todo dia',
  WEEKDAYS: 'De segunda a sexta',
  WEEKLY: 'Uma vez por semana',
};

export const WEEKDAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export interface DonationTemplate {
  id: string;
  name: string;
  allowPartial: boolean;
  notes?: string | null;
  items: TemplateItem[];
  recurrence: DonationRecurrence;
  hourOfDay: number;
  weekday?: number | null;
  pickupWindowHours: number;
  expiresInHours: number;
  isActive: boolean;
  lastGeneratedAt?: string | null;
}

export interface CreateTemplateInput {
  name: string;
  items: TemplateItem[];
  allowPartial: boolean;
  notes?: string;
  recurrence: DonationRecurrence;
  hourOfDay: number;
  weekday?: number;
  pickupWindowHours?: number;
  expiresInHours?: number;
}

export async function fetchTemplates() {
  const { data } = await api.get<DonationTemplate[]>('/donation-templates');
  return data;
}

export async function createTemplate(input: CreateTemplateInput) {
  const { data } = await api.post<DonationTemplate>('/donation-templates', input);
  return data;
}

export async function setTemplateActive(id: string, isActive: boolean) {
  const { data } = await api.put<DonationTemplate>(`/donation-templates/${id}`, { isActive });
  return data;
}

export async function deleteTemplate(id: string) {
  const { data } = await api.delete(`/donation-templates/${id}`);
  return data;
}
