import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelDonation, fetchDonations, CATEGORY_LABEL, STATUS_LABEL, type Donation } from '../lib/donations';
import { reserveDonation, confirmPickup } from '../lib/reservations';
import { getApiErrorMessage } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';

function ConfirmPickupForm({ donationId, mode }: { donationId: string; mode: 'own' | 'available' }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (pickupCode: string) => confirmPickup(donationId, pickupCode),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['donations', mode] });
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
      className="mt-3 flex flex-wrap items-center gap-2"
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

const STATUS_BADGE: Record<Donation['status'], string> = {
  AVAILABLE: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-400',
  RESERVED: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  PICKUP_PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  PICKED_UP: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400',
  DISTRIBUTED: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400',
  EXPIRED: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
  CANCELLED: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function DonationsList({ mode }: { mode: 'own' | 'available' }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);

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

  const reserveMutation = useMutation({
    mutationFn: reserveDonation,
    onSuccess: (reservation) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['donations', mode] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      showToast(`Doação reservada! Código de retirada: ${reservation.pickupCode}`, 'success');
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível reservar esta doação.')),
  });

  if (query.isLoading) {
    return <p className="text-sm text-neutral-500">Carregando doações…</p>;
  }

  const items = query.data?.items ?? [];

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
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
      {items.map((donation) => (
        <div
          key={donation.id}
          className="rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:hover:border-neutral-700"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white">{donation.foodName}</h3>
              <p className="text-sm text-neutral-500">
                {CATEGORY_LABEL[donation.category]} · {donation.quantity} {donation.unit}
                {donation.donorOrganization && mode === 'available' && (
                  <> · {donation.donorOrganization.tradeName} ({donation.donorOrganization.address.city})</>
                )}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[donation.status]}`}>
              {STATUS_LABEL[donation.status]}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Retirada até {formatDate(donation.pickupDeadline)} · validade {formatDate(donation.expiresAt)}
          </p>
          {mode === 'own' && donation.status === 'AVAILABLE' && (
            <Button
              variant="danger"
              size="sm"
              className="mt-3 px-0"
              onClick={() => cancelMutation.mutate(donation.id)}
              loading={cancelMutation.isPending}
            >
              Cancelar doação
            </Button>
          )}
          {mode === 'available' && donation.status === 'AVAILABLE' && (
            <Button
              size="sm"
              className="mt-3"
              onClick={() => reserveMutation.mutate(donation.id)}
              loading={reserveMutation.isPending}
            >
              Reservar
            </Button>
          )}
          {mode === 'own' && donation.status === 'RESERVED' && (
            <ConfirmPickupForm donationId={donation.id} mode={mode} />
          )}
        </div>
      ))}
    </div>
  );
}
