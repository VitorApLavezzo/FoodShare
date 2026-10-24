import { formatQuantity } from '../lib/format';
import type { DonationItem, DonationList } from '../lib/donations';
import type { ItemSelection, ReserveDonation } from '../lib/use-reserve-donation';
import { Button } from './ui/Button';

/** Quantidade escolhida de um item, para o resumo. */
function chosenQuantity(selection: ItemSelection | undefined) {
  const quantity = Number(selection?.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
}

/**
 * Resumo do que vai ser reservado e o botão — no painel lateral, sempre à vista
 * enquanto a ONG escolhe os itens. Antes o botão ficava no fim da página,
 * depois de todos os itens.
 */
export function ReservePanel({
  donationList,
  reserve,
}: {
  donationList: DonationList;
  reserve: ReserveDonation;
}) {
  const { selectedItems, selections, submit, error, isPending } = reserve;
  const count = selectedItems.length;

  return (
    <section className="flex flex-col gap-3.5 rounded-3xl bg-leaf-800 p-5">
      <div>
        <h2 className="font-display text-[22px] font-semibold text-canvas">Reservar</h2>
        <p className="mt-0.5 text-sm text-leaf-200">
          {donationList.allowPartial
            ? 'Marque os itens que vai buscar e ajuste a quantidade, se quiser levar menos.'
            : 'Este doador entrega a lista inteira, de uma vez só.'}
        </p>
      </div>

      {count > 0 ? (
        <ul className="flex flex-col gap-1.5 rounded-2xl bg-canvas px-4 py-3 text-sm text-ink">
          {selectedItems.map((item: DonationItem) => {
            const quantity = chosenQuantity(selections[item.id]);
            return (
              <li key={item.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 font-semibold">{item.foodName}</span>
                <span className="shrink-0 text-ink-soft">
                  {formatQuantity(quantity, item.unit)}
                  {quantity < item.remainingQuantity && (
                    <span className="text-ink-muted">
                      {' '}
                      de {formatQuantity(item.remainingQuantity, item.unit)}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-leaf-900/40 px-4 py-3 text-sm text-leaf-200">
          Nenhum item marcado ainda.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-900">
          {error}
        </p>
      )}

      <Button
        variant="accent"
        size="lg"
        className="w-full"
        loading={isPending}
        disabled={count === 0}
        onClick={submit}
      >
        {!donationList.allowPartial
          ? 'Reservar a lista inteira'
          : count === 0
            ? 'Marque um item para reservar'
            : `Reservar ${count} ${count === 1 ? 'item' : 'itens'}`}
      </Button>

      <p className="text-xs leading-relaxed text-leaf-200">
        Ao reservar, você recebe um código para mostrar na retirada. Se surgir um imprevisto, dá pra cancelar
        depois.
      </p>
    </section>
  );
}
