import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RESERVATION_STATUS_LABEL as STATUS_LABEL } from '@foodshare/types';
import { cancelReservation, fetchReservations, type Reservation } from '../lib/reservations';
import { getApiErrorMessage } from '../lib/api';
import { formatDateTime, formatQuantity } from '../lib/format';
import { ChatPanel } from './ChatPanel';
import { QueryState } from './ui/QueryState';
import { useAuth } from '../context/AuthContext';

const STATUS_BADGE: Record<Reservation['status'], string> = {
  ACTIVE: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-400',
  CANCELLED: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
  COMPLETED: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400',
  EXPIRED: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
};

export function ReservationsList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);

  const isNgo = user?.role === 'NGO';
  const query = useQuery({ queryKey: ['reservations'], queryFn: fetchReservations });

  // O sino manda para cá com ?conversa=<id> quando chega mensagem nova. A lista
  // é carregada de forma assíncrona, então a conversa só pode ser aberta quando
  // a reserva correspondente aparecer — e o parâmetro é removido logo depois,
  // para que um refetch não reabra o chat que o usuário acabou de fechar.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedConversationId = searchParams.get('conversa');

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['donations'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível cancelar a reserva.')),
  });

  const confirmCancel = (reservation: Reservation) => {
    const itens = reservation.items
      .map((i) => i.donationItem?.foodName)
      .filter(Boolean)
      .join(', ');
    if (!window.confirm(`Cancelar a reserva de ${itens || 'estes itens'}? Eles voltam a ficar disponíveis.`))
      return;
    cancelMutation.mutate(reservation.id);
  };

  const items = query.data ?? [];
  const conversationIds = items.map((reservation) => reservation.conversationId ?? '').join(',');

  useEffect(() => {
    if (!requestedConversationId) return;
    const match = (query.data ?? []).find(
      (reservation) => reservation.conversationId === requestedConversationId,
    );
    if (!match) return;

    setOpenChatId(match.id);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('conversa');
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedConversationId, conversationIds]);

  return (
    <QueryState
      isLoading={query.isLoading}
      isError={query.isError}
      error={query.error}
      isEmpty={items.length === 0}
      emptyMessage={isNgo ? 'Você ainda não fez nenhuma reserva.' : 'Nenhuma reserva recebida ainda.'}
      onRetry={() => query.refetch()}
    >
      <div className="flex flex-col gap-3">
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
          >
            {error}
          </p>
        )}
        {items.map((reservation) => (
          <div
            key={reservation.id}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-neutral-900 dark:text-white">
                  {reservation.items
                    .map((i) => i.donationItem?.foodName ?? '')
                    .filter(Boolean)
                    .join(', ')}
                </h3>
                <p className="text-sm text-neutral-500">
                  {reservation.items
                    .map((i) => formatQuantity(i.quantity, i.donationItem?.unit ?? ''))
                    .join(' · ')}
                </p>
                {/* O código é apresentado pela ONG ao doador no momento da
                    retirada: se o doador também o visse na tela, poderia
                    confirmar sozinho e a conferência presencial perderia o
                    sentido. */}
                {isNgo && (
                  <p className="mt-1 text-sm text-neutral-500">
                    Código de retirada: <span className="font-mono">{reservation.pickupCode}</span>
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${STATUS_BADGE[reservation.status]}`}
              >
                {STATUS_LABEL[reservation.status]}
              </span>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              Reservada em {formatDateTime(reservation.reservedAt)} · retirada até{' '}
              {formatDateTime(reservation.donationList.pickupDeadline)}
            </p>
            <div className="mt-3 flex items-center gap-4">
              {reservation.status === 'ACTIVE' && isNgo && (
                <button
                  onClick={() => confirmCancel(reservation)}
                  disabled={cancelMutation.isPending}
                  className="text-sm font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
                >
                  Cancelar reserva
                </button>
              )}
              {reservation.conversationId && (
                <button
                  onClick={() => setOpenChatId((prev) => (prev === reservation.id ? null : reservation.id))}
                  className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  {openChatId === reservation.id ? 'Fechar conversa' : 'Conversar'}
                </button>
              )}
            </div>
            {openChatId === reservation.id && reservation.conversationId && (
              <div className="mt-3">
                <ChatPanel conversationId={reservation.conversationId} />
              </div>
            )}
          </div>
        ))}
      </div>
    </QueryState>
  );
}
