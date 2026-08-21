import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cancelReservation, fetchReservations, type Reservation } from '../lib/reservations';
import { getApiErrorMessage } from '../lib/api';
import { ChatPanel } from './ChatPanel';
import { useAuth } from '../context/AuthContext';

const STATUS_LABEL: Record<Reservation['status'], string> = {
  ACTIVE: 'Ativa',
  CANCELLED: 'Cancelada',
  COMPLETED: 'Concluída',
};

const STATUS_BADGE: Record<Reservation['status'], string> = {
  ACTIVE: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-400',
  CANCELLED: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
  COMPLETED: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ReservationsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['reservations'], queryFn: fetchReservations });

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['donations'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível cancelar a reserva.')),
  });

  if (query.isLoading) return <p className="text-sm text-neutral-500">Carregando reservas…</p>;

  const items = query.data ?? [];

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {user?.role === 'NGO' ? 'Você ainda não fez nenhuma reserva.' : 'Nenhuma reserva recebida ainda.'}
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
      {items.map((reservation) => (
        <div key={reservation.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                {reservation.items.map((i) => i.donationItem?.foodName ?? '').filter(Boolean).join(', ')}
              </h3>
              <p className="text-sm text-neutral-500">
                Código de retirada: <span className="font-mono">{reservation.pickupCode}</span>
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[reservation.status]}`}>
              {STATUS_LABEL[reservation.status]}
            </span>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Reservada em {formatDate(reservation.reservedAt)} · retirada até{' '}
            {formatDate(reservation.donationList.pickupDeadline)}
          </p>
          <div className="mt-3 flex items-center gap-4">
            {reservation.status === 'ACTIVE' && user?.role === 'NGO' && (
              <button
                onClick={() => cancelMutation.mutate(reservation.id)}
                disabled={cancelMutation.isPending}
                className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
              >
                Cancelar reserva
              </button>
            )}
            <button
              onClick={() => setOpenChatId((prev) => (prev === reservation.id ? null : reservation.id))}
              className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {openChatId === reservation.id ? 'Fechar conversa' : 'Conversar'}
            </button>
          </div>
          {openChatId === reservation.id && reservation.conversationId && (
            <div className="mt-3">
              <ChatPanel conversationId={reservation.conversationId} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
