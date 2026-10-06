import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reserveDonationItems, type ReserveItemInput } from '../lib/reservations';
import { getApiErrorMessage } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';
import type { DonationList } from '../lib/donations';

interface ItemSelection {
  selected: boolean;
  mode: 'all' | 'partial';
  quantity: string;
}

/** Alternador Tudo/Parcial: dois estados excludentes, sem rádio solto na linha. */
function ModeToggle({
  mode,
  onChange,
}: {
  mode: 'all' | 'partial';
  onChange: (mode: 'all' | 'partial') => void;
}) {
  const option = (value: 'all' | 'partial', label: string) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={mode === value}
      className={`rounded-full px-3 py-1 text-[13px] font-semibold transition ${
        mode === value ? 'bg-leaf-800 text-canvas' : 'text-ink-soft hover:text-leaf-800'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex rounded-full bg-sand p-[3px]">
      {option('all', 'Tudo')}
      {option('partial', 'Parcial')}
    </div>
  );
}

export function ReserveDonationListForm({ donationList }: { donationList: DonationList }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const availableItems = donationList.items.filter((item) => item.status === 'AVAILABLE');

  // A tupla é anotada porque, sem isso, `mode` alarga para `string` e deixa de
  // casar com o literal 'all' | 'partial' de ItemSelection.
  const defaultSelections = (): Record<string, ItemSelection> =>
    Object.fromEntries(
      availableItems.map((item): [string, ItemSelection] => [
        item.id,
        { selected: !donationList.allowPartial, mode: 'all', quantity: '' },
      ]),
    );

  const [selections, setSelections] = useState<Record<string, ItemSelection>>(defaultSelections);

  // O estado nasce no primeiro render e a lista é refeita a cada reserva: sem
  // ressincronizar, um item que acabou de aparecer (ou de sumir) ficava sem
  // seleção e o formulário recusava o envio dizendo que nada foi escolhido.
  const availableIds = availableItems.map((item) => item.id).join(',');
  useEffect(() => {
    setSelections(defaultSelections());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableIds, donationList.allowPartial]);

  const mutation = useMutation({
    mutationFn: (items: ReserveItemInput[]) => reserveDonationItems(donationList.id, items),
    onSuccess: (reservation) => {
      setError(null);
      // ['donation', id] é a tela de detalhe: sem invalidar aqui ela continuava
      // mostrando o saldo anterior, e um segundo clique reservava de novo
      // partindo de um número que já não existia mais.
      queryClient.invalidateQueries({ queryKey: ['donation', donationList.id] });
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      // Limpa só as quantidades digitadas: o campo com o número anterior ainda
      // na tela é o que convidava ao segundo clique.
      setSelections((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([id, selection]) => [id, { ...selection, quantity: '' }]),
        ),
      );
      showToast(`Reserva feita! Código de retirada: ${reservation.pickupCode}`, 'success');
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível reservar esta doação.')),
  });

  if (availableItems.length === 0) return null;

  const submit = () => {
    // Cada clique cria uma reserva nova e desconta de novo. O botão já fica
    // desabilitado enquanto `isPending`, mas essa guarda cobre a janela entre o
    // clique e o React aplicar o novo estado — é onde o clique repetido passava.
    if (mutation.isPending) return;

    const items: ReserveItemInput[] = [];
    for (const item of availableItems) {
      const selection = selections[item.id];
      if (!selection?.selected) continue;
      if (selection.mode === 'all') {
        items.push({ donationItemId: item.id });
      } else {
        const quantity = Number(selection.quantity);
        if (!quantity || quantity <= 0) {
          setError(`Informe uma quantidade válida para "${item.foodName}".`);
          return;
        }
        // Validado no cliente além do servidor: o erro aparece junto do campo,
        // com o nome do alimento, antes de gastar uma ida à API.
        if (quantity > item.remainingQuantity) {
          setError(
            `Só restam ${item.remainingQuantity} ${item.unit} de "${item.foodName}" — reduza a quantidade.`,
          );
          return;
        }
        items.push({ donationItemId: item.id, quantity });
      }
    }
    if (items.length === 0) {
      setError('Selecione ao menos um item.');
      return;
    }
    setError(null);
    mutation.mutate(items);
  };

  const update = (id: string, patch: Partial<ItemSelection>) =>
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  return (
    <section className="flex flex-col gap-3.5 rounded-3xl bg-leaf-800 p-6">
      <div>
        <h2 className="font-display text-[22px] font-semibold text-canvas">Reservar</h2>
        <p className="mt-1 text-sm text-leaf-200">
          {donationList.allowPartial
            ? 'Escolha o que vai buscar. Dá pra levar tudo ou só uma parte.'
            : 'Este doador pede que a lista seja levada inteira, de uma vez só.'}
        </p>
      </div>

      {donationList.allowPartial &&
        availableItems.map((item) => {
          const selection = selections[item.id];
          const checked = selection?.selected ?? false;
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-canvas px-3.5 py-3 text-sm"
            >
              <button
                type="button"
                onClick={() => update(item.id, { selected: !checked })}
                aria-pressed={checked}
                className="flex items-center gap-2.5 rounded-sm text-ink focus-visible:ring-4 focus-visible:ring-leaf-600/30 focus-visible:outline-none"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-[7px] border-2 border-leaf-800 text-[13px] font-bold transition ${
                    checked ? 'bg-leaf-800 text-canvas' : 'bg-surface text-transparent'
                  }`}
                  aria-hidden
                >
                  ✓
                </span>
                <span>
                  <strong className="font-bold">{item.foodName}</strong> ({item.remainingQuantity} {item.unit}{' '}
                  disponíveis)
                </span>
              </button>

              {checked && (
                <div className="ml-auto flex items-center gap-1.5">
                  <ModeToggle mode={selection.mode} onChange={(mode) => update(item.id, { mode })} />
                  {selection.mode === 'partial' && (
                    <input
                      type="number"
                      min={0}
                      max={item.remainingQuantity}
                      step="any"
                      value={selection.quantity}
                      onChange={(e) => update(item.id, { quantity: e.target.value })}
                      placeholder={`até ${item.remainingQuantity}`}
                      aria-label={`Quantidade de ${item.foodName}`}
                      className="w-[90px] rounded-full border-[1.5px] border-line-strong bg-surface px-3 py-1.5 text-[13px] text-ink transition placeholder:text-ink-faint focus:border-leaf-600 focus:ring-4 focus:ring-leaf-600/20 focus:outline-none"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

      {error && (
        <p role="alert" className="rounded-2xl bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-900">
          {error}
        </p>
      )}

      <Button
        variant="accent"
        size="md"
        className="self-start"
        loading={mutation.isPending}
        disabled={mutation.isPending}
        onClick={submit}
      >
        {donationList.allowPartial
          ? 'Reservar selecionados'
          : `Reservar tudo (${availableItems.length} ${availableItems.length === 1 ? 'item' : 'itens'})`}
      </Button>
    </section>
  );
}
