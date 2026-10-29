import { BadRequestException } from '@nestjs/common';

const DAY_MS = 86_400_000;

/** A ONG precisa de ao menos um dia, contado da publicação, para se organizar e buscar. */
export const MIN_PICKUP_WINDOW_MS = DAY_MS;
/** Retirar no mesmo dia em que o alimento vence não dá margem nenhuma para distribuir. */
export const MIN_SHELF_LIFE_AFTER_PICKUP_MS = DAY_MS;

export interface ItemDates {
  pickupDeadline: Date;
  expiresAt: Date;
}

interface DatesInput {
  allowPartial: boolean;
  pickupDeadline?: string;
  expiresAt?: string;
  items: { foodName: string; pickupDeadline?: string; expiresAt?: string }[];
}

/**
 * Datas efetivas de cada item. O que vem no item vale; o que vem na lista é o
 * valor para os itens que não trouxeram o próprio.
 *
 * Sem aceite parcial a lista sai inteira numa única retirada, então o prazo é
 * um só: itens com prazos diferentes ali não teriam como ser cumpridos.
 */
export function resolveItemDates(input: DatesInput): ItemDates[] {
  const resolved = input.items.map((item) => {
    const pickupDeadline = item.pickupDeadline ?? input.pickupDeadline;
    const expiresAt = item.expiresAt ?? input.expiresAt;
    if (!pickupDeadline) {
      throw new BadRequestException({
        code: 'MISSING_PICKUP_DEADLINE',
        message: `Informe o prazo de retirada de "${item.foodName}".`,
      });
    }
    if (!expiresAt) {
      throw new BadRequestException({
        code: 'MISSING_EXPIRATION',
        message: `Informe a validade de "${item.foodName}".`,
      });
    }
    return { pickupDeadline: new Date(pickupDeadline), expiresAt: new Date(expiresAt) };
  });

  if (!input.allowPartial) {
    const first = resolved[0].pickupDeadline.getTime();
    if (resolved.some((dates) => dates.pickupDeadline.getTime() !== first)) {
      throw new BadRequestException({
        code: 'PICKUP_DEADLINE_MUST_BE_SHARED',
        message: 'Sem reserva parcial, todos os itens têm o mesmo prazo de retirada.',
      });
    }
  }

  return resolved;
}

/**
 * Regras de data de uma doação, item a item:
 * - o prazo de retirada vem depois do início da disponibilidade;
 * - o prazo de retirada fica ao menos 1 dia depois da publicação;
 * - a validade fica ao menos 1 dia depois do prazo de retirada (nunca no mesmo
 *   dia — e, por consequência, nunca no passado).
 *
 * As durações são de 24h, e não de "dia do calendário": a API não sabe o fuso
 * de quem publica, e 24h garante as duas leituras ao mesmo tempo.
 */
export function assertValidDonationDates(
  availableAt: Date,
  postedAt: Date,
  items: (ItemDates & { foodName: string })[],
) {
  // Com um item só, o nome do alimento na mensagem é redundante.
  const label = (foodName: string) => (items.length > 1 ? ` de "${foodName}"` : '');

  for (const item of items) {
    if (item.pickupDeadline <= availableAt) {
      throw new BadRequestException({
        code: 'INVALID_PICKUP_DEADLINE',
        message: `O prazo de retirada${label(item.foodName)} deve ser posterior ao início da disponibilidade.`,
      });
    }
    if (item.pickupDeadline.getTime() < postedAt.getTime() + MIN_PICKUP_WINDOW_MS) {
      throw new BadRequestException({
        code: 'INVALID_PICKUP_DEADLINE',
        message: `O prazo de retirada${label(item.foodName)} precisa ser de pelo menos 1 dia depois da publicação.`,
      });
    }
    if (item.expiresAt.getTime() < item.pickupDeadline.getTime() + MIN_SHELF_LIFE_AFTER_PICKUP_MS) {
      throw new BadRequestException({
        code: 'INVALID_EXPIRATION',
        message: `A validade${label(item.foodName)} precisa ser de pelo menos 1 dia depois do prazo de retirada.`,
      });
    }
  }
}

/** Datas da lista: as mais tardias entre os itens (até quando algo ainda pode acontecer nela). */
export function latestItemDates(items: ItemDates[]): ItemDates {
  return {
    pickupDeadline: new Date(Math.max(...items.map((item) => item.pickupDeadline.getTime()))),
    expiresAt: new Date(Math.max(...items.map((item) => item.expiresAt.getTime()))),
  };
}
