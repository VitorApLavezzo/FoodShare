/**
 * Enums de domínio compartilhados entre a API e a web.
 *
 * A fonte da verdade continua sendo o `schema.prisma`; este arquivo é o espelho
 * consumido pelo frontend, que antes redeclarava os mesmos valores em cada
 * arquivo que precisava deles (adicionar uma categoria de alimento exigia
 * editar nove arquivos). O teste `shared-types.spec.ts`, na API, falha se estes
 * valores saírem de sincronia com os do Prisma.
 *
 * Os rótulos em português moram aqui junto dos valores porque a ordem de
 * exibição e o texto são os mesmos em toda a interface — as listas de opções
 * são derivadas destes mapas, nunca escritas à mão.
 */

export const DONATION_CATEGORY_LABEL = {
  PREPARED_MEALS: 'Alimentos preparados',
  PACKAGED_GOODS: 'Alimentos industrializados',
  NATURAL_FOODS: 'Alimentos naturais',
} as const;

export type DonationCategory = keyof typeof DONATION_CATEGORY_LABEL;
export const DONATION_CATEGORIES = Object.keys(DONATION_CATEGORY_LABEL) as DonationCategory[];

export const DONATION_LIST_STATUS_LABEL = {
  OPEN: 'Disponível',
  FULLY_RESERVED: 'Totalmente reservada',
  CANCELLED: 'Cancelada',
  CLOSED: 'Encerrada',
  EXPIRED: 'Expirada',
} as const;

export type DonationListStatus = keyof typeof DONATION_LIST_STATUS_LABEL;
export const DONATION_LIST_STATUSES = Object.keys(DONATION_LIST_STATUS_LABEL) as DonationListStatus[];

export const DONATION_ITEM_STATUS_LABEL = {
  AVAILABLE: 'Disponível',
  FULLY_RESERVED: 'Reservado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Expirado',
} as const;

export type DonationItemStatus = keyof typeof DONATION_ITEM_STATUS_LABEL;
export const DONATION_ITEM_STATUSES = Object.keys(DONATION_ITEM_STATUS_LABEL) as DonationItemStatus[];

export const RESERVATION_STATUS_LABEL = {
  ACTIVE: 'Ativa',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Concluída',
  EXPIRED: 'Não retirada',
} as const;

export type ReservationStatus = keyof typeof RESERVATION_STATUS_LABEL;
export const RESERVATION_STATUSES = Object.keys(RESERVATION_STATUS_LABEL) as ReservationStatus[];

export const NOTIFICATION_TYPE_LABEL = {
  NEW_DONATION_NEARBY: 'Nova doação por perto',
  RESERVATION_DEADLINE_SOON: 'Prazo de retirada chegando',
  DONATION_RESERVED: 'Doação reservada',
  PICKUP_CONFIRMED: 'Retirada confirmada',
  NEW_MESSAGE: 'Nova mensagem',
  GENERIC: 'Aviso',
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPE_LABEL;

export const ORGANIZATION_TYPE_LABEL = {
  RESTAURANT: 'Restaurante',
  MARKET: 'Mercado',
  BAKERY: 'Padaria',
  OTHER: 'Outro',
} as const;

export type OrganizationType = keyof typeof ORGANIZATION_TYPE_LABEL;
export const ORGANIZATION_TYPES = Object.keys(ORGANIZATION_TYPE_LABEL) as OrganizationType[];

export const APPROVAL_STATUS_LABEL = {
  PENDING: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  BLOCKED: 'Bloqueado',
} as const;

export type ApprovalStatus = keyof typeof APPROVAL_STATUS_LABEL;

export type UserRole = 'ADMIN' | 'DONOR' | 'NGO';
export type OrganizationKind = 'DONOR' | 'NGO';
