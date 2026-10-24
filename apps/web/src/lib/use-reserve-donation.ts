import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reserveDonationItems, type ReserveItemInput } from './reservations';
import { getApiErrorMessage } from './api';
import { formatQuantity } from './format';
import { useToast } from '../context/ToastContext';
import type { DonationList } from './donations';

export interface ItemSelection {
  selected: boolean;
  quantity: string;
}

/**
 * Estado e envio da reserva. Fica num hook porque a escolha acontece nos
 * próprios cards dos itens e o botão mora no painel lateral — antes os itens
 * apareciam duas vezes (nos cards e de novo numa lista com caixas de seleção),
 * e a ONG tinha de cruzar uma lista com a outra.
 *
 * Marcar um item já traz a quantidade toda; a ONG só mexe no número se quiser
 * levar menos. Substitui o alternador "Tudo/Parcial" + campo vazio, que pedia
 * duas decisões para o caso mais comum.
 */
export function useReserveDonation(donationList: DonationList) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const availableItems = donationList.items.filter((item) => item.status === 'AVAILABLE');

  // Tudo marcado com a quantidade toda: é o caso mais comum, e a ONG desmarca
  // ou reduz o que não quer. (Depois de reservar o formulário some — a regra é
  // uma reserva ativa por ONG em cada doação.)
  const defaults = (): Record<string, ItemSelection> =>
    Object.fromEntries(
      availableItems.map((item): [string, ItemSelection] => [
        item.id,
        { selected: true, quantity: String(item.remainingQuantity) },
      ]),
    );

  const [selections, setSelections] = useState<Record<string, ItemSelection>>(defaults);

  // Saldo mudou (outra ONG reservou nesse meio-tempo): os números na tela
  // precisam ser os de agora.
  const signature = availableItems.map((item) => `${item.id}:${item.remainingQuantity}`).join(',');
  useEffect(() => {
    setSelections(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const mutation = useMutation({
    mutationFn: (items: ReserveItemInput[]) => reserveDonationItems(donationList.id, items),
    onSuccess: () => {
      setError(null);
      // ['donation', id] é a tela de detalhe: sem invalidar aqui ela continuava
      // mostrando o saldo anterior, e um segundo clique reservava de novo
      // partindo de um número que já não existia mais.
      queryClient.invalidateQueries({ queryKey: ['donation', donationList.id] });
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['map'] });
      showToast('Reserva confirmada! O código de retirada está no topo da página.', 'success');
      // O quadro de confirmação, com o código e os próximos passos, fica no topo.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Não foi possível reservar esta doação.'));
      // A recusa costuma significar que a tela ficou velha (reserva feita em
      // outra aba, item que outra ONG levou): recarrega para mostrar o atual.
      queryClient.invalidateQueries({ queryKey: ['donation', donationList.id] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
  });

  const toggle = (id: string) =>
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], selected: !prev[id]?.selected } }));

  const setQuantity = (id: string, quantity: string) =>
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], quantity } }));

  const setAll = (selected: boolean) =>
    setSelections((prev) =>
      Object.fromEntries(Object.entries(prev).map(([id, selection]) => [id, { ...selection, selected }])),
    );

  const selectedItems = availableItems.filter((item) => selections[item.id]?.selected);

  const submit = () => {
    // Cada clique cria uma reserva nova e desconta de novo. O botão já fica
    // desabilitado enquanto `isPending`, mas essa guarda cobre a janela entre o
    // clique e o React aplicar o novo estado — é onde o clique repetido passava.
    if (mutation.isPending) return;

    const items: ReserveItemInput[] = [];
    for (const item of selectedItems) {
      const quantity = Number(selections[item.id].quantity);
      if (!quantity || quantity <= 0) {
        setError(`Informe quanto vai levar de "${item.foodName}".`);
        return;
      }
      // Validado no cliente além do servidor: o erro aparece com o nome do
      // alimento, antes de gastar uma ida à API.
      if (quantity > item.remainingQuantity) {
        setError(`Só restam ${formatQuantity(item.remainingQuantity, item.unit)} de "${item.foodName}".`);
        return;
      }
      // A quantidade toda vai sem número: a API reserva o saldo inteiro.
      items.push(
        quantity === item.remainingQuantity
          ? { donationItemId: item.id }
          : { donationItemId: item.id, quantity },
      );
    }
    if (items.length === 0) {
      setError('Marque ao menos um item.');
      return;
    }
    setError(null);
    mutation.mutate(items);
  };

  return {
    availableItems,
    selections,
    selectedItems,
    toggle,
    setQuantity,
    setAll,
    submit,
    error,
    isPending: mutation.isPending,
  };
}

export type ReserveDonation = ReturnType<typeof useReserveDonation>;
