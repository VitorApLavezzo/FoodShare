import {
  DONATION_CATEGORY_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  DONATION_LIST_STATUS_LABEL,
  type DonationCategory,
  type DonationItemStatus,
  type DonationListStatus,
  type OrganizationType,
} from '@foodshare/types';
import { api } from './api';
import type { PostalAddress } from './address';

// Reexporta para os componentes não precisarem saber de onde vêm os enums.
export { DONATION_CATEGORY_LABEL as CATEGORY_LABEL, DONATION_ITEM_STATUS_LABEL, DONATION_LIST_STATUS_LABEL };
export type { DonationCategory, DonationItemStatus, DonationListStatus };

export interface DonationItem {
  id: string;
  foodName: string;
  category: DonationCategory;
  description?: string | null;
  quantity: number;
  remainingQuantity: number;
  unit: string;
  status: DonationItemStatus;
  imageUrl?: string | null;
  allergens?: string | null;
  storageCondition?: string | null;
  pickupDeadline: string;
  expiresAt: string;
}

export interface DonationList {
  id: string;
  allowPartial: boolean;
  status: DonationListStatus;
  notes?: string | null;
  availableAt: string;
  /** O mais tardio entre os itens: cada item tem o seu prazo e a sua validade. */
  pickupDeadline: string;
  expiresAt: string;
  createdAt: string;
  items: DonationItem[];
  donorOrganization?: {
    tradeName: string;
    type?: OrganizationType | null;
    phone?: string;
    operatingHours?: string | null;
    address: PostalAddress;
    completedPickupCount?: number;
    noShowCount?: number;
  };
}

export interface CreateDonationItemInput {
  foodName: string;
  category: DonationCategory;
  description?: string;
  quantity: number;
  unit: string;
  batch?: string;
  storageCondition?: string;
  imageUrl?: string;
  allergens?: string;
  /** Só com reserva parcial; sem ela, vale o prazo único da lista. */
  pickupDeadline?: string;
  expiresAt: string;
}

export interface CreateDonationListInput {
  items: CreateDonationItemInput[];
  allowPartial: boolean;
  notes?: string;
  availableAt: string;
  /** Prazo único, para a lista sem reserva parcial. */
  pickupDeadline?: string;
}

export interface UpdateDonationListInput {
  notes?: string;
  availableAt?: string;
  pickupDeadline?: string;
  items?: { id: string; pickupDeadline?: string; expiresAt?: string }[];
}

export interface DonationListsPage {
  items: DonationList[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchDonations(
  params: { category?: string; search?: string; city?: string; page?: number; limit?: number } = {},
) {
  const { data } = await api.get<DonationListsPage>('/donations', { params });
  return data;
}

export async function fetchDonation(id: string) {
  const { data } = await api.get<DonationList>(`/donations/${id}`);
  return data;
}

export async function createDonation(input: CreateDonationListInput) {
  const { data } = await api.post<DonationList>('/donations', input);
  return data;
}

export async function updateDonation(id: string, input: UpdateDonationListInput) {
  const { data } = await api.put<DonationList>(`/donations/${id}`, input);
  return data;
}

export async function cancelDonation(id: string) {
  const { data } = await api.delete<DonationList>(`/donations/${id}`);
  return data;
}

/** Envia a foto do alimento e devolve a URL pública para anexar ao item. */
export async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post<{ url: string }>('/uploads/images', formData);
  return data.url;
}

const DAY_MS = 86_400_000;

export interface ItemDateValues {
  pickupDeadline: string;
  expiresAt: string;
}

export interface DonationDateIssue {
  index: number;
  field: keyof ItemDateValues;
  message: string;
}

/**
 * As mesmas regras de data que a API aplica, item a item, checadas antes do
 * envio para o erro aparecer embaixo do campo certo — e não só como um aviso
 * genérico no fim do formulário depois da ida ao servidor:
 * - retirada depois do início da disponibilidade e ao menos 1 dia depois da
 *   publicação;
 * - validade ao menos 1 dia depois da retirada (nunca no mesmo dia).
 */
export function donationDateIssues({
  availableAt,
  postedAt = new Date(),
  items,
}: {
  availableAt: string;
  postedAt?: Date;
  items: ItemDateValues[];
}) {
  const issues: DonationDateIssue[] = [];
  const available = availableAt ? new Date(availableAt) : null;

  items.forEach(({ pickupDeadline, expiresAt }, index) => {
    if (!pickupDeadline) return;
    const deadline = new Date(pickupDeadline);

    if (available && deadline <= available) {
      issues.push({
        index,
        field: 'pickupDeadline',
        message: 'O prazo de retirada precisa ser depois da disponibilidade.',
      });
    } else if (deadline.getTime() < postedAt.getTime() + DAY_MS) {
      issues.push({
        index,
        field: 'pickupDeadline',
        message: 'O prazo de retirada precisa ser de pelo menos 1 dia depois da publicação.',
      });
    }

    if (expiresAt && new Date(expiresAt).getTime() < deadline.getTime() + DAY_MS) {
      issues.push({
        index,
        field: 'expiresAt',
        message: 'A validade precisa ser de pelo menos 1 dia depois do prazo de retirada.',
      });
    }
  });
  return issues;
}

/** Menor prazo de retirada aceito numa publicação feita agora (para o `min` do campo). */
export function minPickupDeadline(postedAt = new Date()) {
  return new Date(postedAt.getTime() + DAY_MS);
}

/** Menor validade aceita para um prazo de retirada (para o `min` do campo). */
export function minExpiresAt(pickupDeadline: string) {
  return pickupDeadline ? new Date(new Date(pickupDeadline).getTime() + DAY_MS) : undefined;
}

/**
 * A data, se for a mesma em todos os itens — aí ela aparece uma vez só, na
 * lista; senão, cada item mostra a sua.
 */
export function sharedItemDate(items: Pick<DonationItem, 'pickupDeadline' | 'expiresAt'>[], key: keyof ItemDateValues) {
  const first = items[0]?.[key];
  if (!first) return null;
  const time = new Date(first).getTime();
  return items.every((item) => new Date(item[key]).getTime() === time) ? first : null;
}

/** A primeira de uma lista de datas — o prazo que vence antes. */
export function earliestDate(dates: (string | undefined)[]) {
  const times = dates.filter((date): date is string => !!date).map((date) => new Date(date).getTime());
  return times.length > 0 ? new Date(Math.min(...times)).toISOString() : undefined;
}

/** Valores iniciais do formulário de doação nova feita a partir de uma já existente. */
export interface DonationDraft {
  allowPartial: boolean;
  notes: string;
  items: (Omit<CreateDonationItemInput, 'batch' | 'storageCondition' | 'pickupDeadline'> & {
    pickupDeadline: string;
  })[];
}

/**
 * Rascunho de uma doação nova a partir de uma já feita: os mesmos alimentos,
 * quantidades e combinados. As datas não vêm junto — as antigas já passaram, e
 * a validade de cada alimento é do lote novo, então precisa ser informada de
 * novo, conscientemente.
 */
export function draftFromDonation(donationList: DonationList): DonationDraft {
  return {
    allowPartial: donationList.allowPartial,
    notes: donationList.notes ?? '',
    items: donationList.items.map((item) => ({
      foodName: item.foodName,
      category: item.category,
      description: item.description ?? '',
      quantity: item.quantity,
      unit: item.unit,
      allergens: item.allergens ?? '',
      imageUrl: item.imageUrl ?? '',
      pickupDeadline: '',
      expiresAt: '',
    })),
  };
}
