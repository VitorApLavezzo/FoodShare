import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelDonation,
  fetchDonations,
  CATEGORY_LABEL,
  DONATION_LIST_STATUS_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  type DonationList,
} from '../lib/donations';
import { confirmPickup } from '../lib/reservations';
import { getApiErrorMessage } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';
import { ReserveDonationListForm } from './ReserveDonationListForm';
import { EditDonationListForm } from './EditDonationListForm';

function ConfirmPickupForm() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (pickupCode: string) => confirmPickup(pickupCode),
    onSuccess: () => {
      setError(null);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      showToast('Retirada confirmada!', 'success');
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Código inválido.')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(code.toUpperCase());
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
        placeholder="Código de retirada"
        className="w-40 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-mono uppercase focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <Button type="submit" size="sm" loading={mutation.isPending} disabled={code.length !== 6}>
        Confirmar retirada
      </Button>
      {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}

const STATUS_BADGE: Record<DonationList['status'], string> = {
  OPEN: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-400',
  FULLY_RESERVED: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  CLOSED: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400',
  CANCELLED: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function DonationsList({ mode }: { mode: 'own' | 'available' }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['donations', mode],
    queryFn: () => fetchDonations(),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelDonation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations', mode] });
      showToast('Doação cancelada.', 'info');
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível cancelar a doação.')),
  });

  if (query.isLoading) {
    return <p className="text-sm text-neutral-500">Carregando doações…</p>;
  }

  // Doações canceladas somem da visão do doador (o cancelamento é definitivo).
  const items = (query.data?.items ?? []).filter(
    (donationList) => mode !== 'own' || donationList.status !== 'CANCELLED',
  );

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {mode === 'own'
          ? 'Você ainda não publicou nenhuma doação.'
          : 'Nenhuma doação encontrada. Tente novamente mais tarde.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === 'own' && (
        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <p className="mb-2 text-xs font-medium text-neutral-500">Confirmar retirada (código apresentado pela ONG)</p>
          <ConfirmPickupForm />
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
      {items.map((donationList) => (
        <div
          key={donationList.id}
          className="rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-700"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                {donationList.items.map((i) => i.foodName).join(', ')}
              </h3>
              <p className="text-sm text-neutral-500">
                {donationList.items.length} {donationList.items.length === 1 ? 'item' : 'itens'} ·{' '}
                {donationList.allowPartial ? 'aceita reserva parcial' : 'só tudo de uma vez'}
                {donationList.donorOrganization && mode === 'available' && (
                  <> · {donationList.donorOrganization.tradeName} ({donationList.donorOrganization.address.city})</>
                )}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[donationList.status]}`}>
              {DONATION_LIST_STATUS_LABEL[donationList.status]}
            </span>
          </div>

          <ul className="mt-2 flex flex-col gap-1">
            {donationList.items.map((item) => (
              <li key={item.id} className="text-xs text-neutral-500">
                {item.foodName} — {CATEGORY_LABEL[item.category]} · {item.remainingQuantity}/{item.quantity} {item.unit} ·{' '}
                {DONATION_ITEM_STATUS_LABEL[item.status]}
              </li>
            ))}
          </ul>

          <p className="mt-2 text-xs text-neutral-500">
            Retirada até {formatDate(donationList.pickupDeadline)} · validade {formatDate(donationList.expiresAt)}
          </p>

          {mode === 'own' && donationList.status === 'OPEN' && editingId !== donationList.id && (
            <div className="mt-3 flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingId(donationList.id)}
              >
                Editar
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="px-0"
                onClick={() => cancelMutation.mutate(donationList.id)}
                loading={cancelMutation.isPending}
              >
                Cancelar doação
              </Button>
            </div>
          )}

          {mode === 'own' && editingId === donationList.id && (
            <EditDonationListForm donationList={donationList} onDone={() => setEditingId(null)} />
          )}

          {mode === 'available' && donationList.status === 'OPEN' && (
            <ReserveDonationListForm donationList={donationList} />
          )}
        </div>
      ))}
    </div>
  );
}
