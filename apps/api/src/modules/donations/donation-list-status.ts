import { DonationItemStatus, DonationListStatus, Prisma, ReservationStatus } from '@prisma/client';

/**
 * Deriva o status da lista a partir do estado real dos itens e das reservas, em
 * vez de cada fluxo (reservar / cancelar / retirar / expirar) chutar um status
 * fixo — era daí que vinham as inconsistências (ex.: cancelar uma reserva
 * reabria como OPEN uma lista já expirada).
 *
 * Regras, em ordem:
 * - CANCELLED é terminal (o doador desistiu): nunca é recalculado.
 * - Ainda há item disponível dentro do prazo de retirada dele -> OPEN.
 * - Nada disponível mas há reserva ativa -> FULLY_RESERVED (aguardando retirada).
 * - Sem reserva ativa e houve ao menos uma retirada -> CLOSED.
 * - Caso contrário (venceu sem ninguém retirar) -> EXPIRED.
 */
export async function recomputeDonationListStatus(
  tx: Prisma.TransactionClient,
  donationListId: string,
): Promise<DonationListStatus> {
  const list = await tx.donationList.findUniqueOrThrow({ where: { id: donationListId } });
  if (list.status === DonationListStatus.CANCELLED) return list.status;

  // O prazo é de cada item: com ele vencido, o item não tem mais como ser
  // buscado, mesmo que o job ainda não o tenha marcado como EXPIRED.
  const [availableItems, activeReservations, completedReservations] = await Promise.all([
    tx.donationItem.count({
      where: { donationListId, status: DonationItemStatus.AVAILABLE, pickupDeadline: { gt: new Date() } },
    }),
    tx.reservation.count({ where: { donationListId, status: ReservationStatus.ACTIVE } }),
    tx.reservation.count({ where: { donationListId, status: ReservationStatus.COMPLETED } }),
  ]);

  let status: DonationListStatus;
  if (availableItems > 0) {
    status = DonationListStatus.OPEN;
  } else if (activeReservations > 0) {
    status = DonationListStatus.FULLY_RESERVED;
  } else if (completedReservations > 0) {
    status = DonationListStatus.CLOSED;
  } else {
    status = DonationListStatus.EXPIRED;
  }

  if (status !== list.status) {
    await tx.donationList.update({
      where: { id: donationListId },
      data: { status, version: { increment: 1 } },
    });
  }

  return status;
}
