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

  if (!donationList.allowPartial) {
    return (
      <div className="mt-3">
        {error && <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button size="sm" loading={mutation.isPending} disabled={mutation.isPending} onClick={submit}>
          Reservar tudo ({availableItems.length} {availableItems.length === 1 ? 'item' : 'itens'})
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      {availableItems.map((item) => {
        const selection = selections[item.id];
        return (
          <div key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selection?.selected ?? false}
                onChange={(e) =>
                  setSelections((prev) => ({
                    ...prev,
                    [item.id]: { ...prev[item.id], selected: e.target.checked },
                  }))
                }
              />
              <span>
                {item.foodName} ({item.remainingQuantity} {item.unit} disponíveis)
              </span>
            </label>
            {selection?.selected && (
              <div className="ml-6 flex items-center gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={`mode-${item.id}`}
                    checked={selection.mode === 'all'}
                    onChange={() =>
                      setSelections((prev) => ({ ...prev, [item.id]: { ...prev[item.id], mode: 'all' } }))
                    }
                  />
                  Tudo
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name={`mode-${item.id}`}
                    checked={selection.mode === 'partial'}
                    onChange={() =>
                      setSelections((prev) => ({ ...prev, [item.id]: { ...prev[item.id], mode: 'partial' } }))
                    }
                  />
                  Parcial
                </label>
                {selection.mode === 'partial' && (
                  <input
                    type="number"
                    min={0}
                    max={item.remainingQuantity}
                    step="any"
                    value={selection.quantity}
                    onChange={(e) =>
                      setSelections((prev) => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], quantity: e.target.value },
                      }))
                    }
                    placeholder={`até ${item.remainingQuantity}`}
                    className="w-24 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button
        size="sm"
        className="self-start"
        loading={mutation.isPending}
        disabled={mutation.isPending}
        onClick={submit}
      >
        Reservar selecionados
      </Button>
    </div>
  );
}
