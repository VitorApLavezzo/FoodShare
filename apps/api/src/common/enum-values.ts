import { DonationCategory, DonationItemStatus, OrganizationType } from '@prisma/client';

/**
 * Listas derivadas direto dos enums do Prisma, em vez de reescritas em cada DTO
 * (eram três cópias da mesma lista de categorias, que precisavam ser editadas
 * juntas). Como vêm do client gerado, não têm como sair de sincronia com o
 * schema — e o validador continua recebendo um array simples.
 */
export const DONATION_CATEGORIES = Object.values(DonationCategory);
export const DONATION_ITEM_STATUSES = Object.values(DonationItemStatus);
export const ORGANIZATION_TYPES = Object.values(OrganizationType);
