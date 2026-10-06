import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RESERVATION_STATUS_LABEL as STATUS_LABEL } from '@foodshare/types';
import { cancelReservation, fetchReservations, type Reservation } from '../lib/reservations';
import { getApiErrorMessage } from '../lib/api';
import { formatDateTime, formatQuantity } from '../lib/format';
import { ChatPanel } from './ChatPanel';
import { Badge, type BadgeTone } from './ui/Badge';
import { InlineButton, InlineDangerButton } from './ui/Button';
import { QueryState } from './ui/QueryState';
import { useAuth } from '../context/AuthContext';

const STATUS_TONE: Record<Reservation['status'], BadgeTone> = {
  ACTIVE: 'leaf',
  CANCELLED: 'stone',
  COMPLETED: 'dusk',
  // Não retirada é aviso, não encerramento tranquilo: fica no âmbar.
  EXPIRED: 'sun',
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
      emptyMessage={isNgo ? 'Você ainda não reservou nada.' : 'Nenhuma reserva recebida ainda.'}
      onRetry={() => query.refetch()}
    >
      <div className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        {items.map((reservation) => (
          <article
            key={reservation.id}
            className="flex flex-col gap-2 rounded-[22px] border border-line bg-surface p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-[17px] font-bold text-ink">
                  {reservation.items
                    .map((i) => i.donationItem?.foodName ?? '')
                    .filter(Boolean)
                    .join(', ')}
                </h3>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {reservation.items
                    .map((i) => formatQuantity(i.quantity, i.donationItem?.unit ?? ''))
                    .join(' · ')}
                </p>
              </div>
              <Badge tone={STATUS_TONE[reservation.status]}>{STATUS_LABEL[reservation.status]}</Badge>
            </div>

            {/* O código é apresentado pela ONG ao doador no momento da retirada:
                se o doador também o visse na tela, poderia confirmar sozinho e a
                conferência presencial perderia o sentido. */}
            {isNgo && reservation.status === 'ACTIVE' && (
              <div className="flex items-center gap-2.5 text-sm text-ink-soft">
                Código de retirada
                <span className="rounded-[10px] bg-sun-50 px-3 py-1 font-mono text-base font-bold tracking-[0.2em] text-sun-800">
                  {reservation.pickupCode}
                </span>
              </div>
            )}

            <p className="text-[13px] text-ink-muted">
              Reservada em {formatDateTime(reservation.reservedAt)} · retirada até{' '}
              {formatDateTime(reservation.donationList.pickupDeadline)}
            </p>

            <div className="mt-0.5 flex items-center gap-4">
              {reservation.status === 'ACTIVE' && isNgo && (
                <InlineDangerButton
                  onClick={() => confirmCancel(reservation)}
                  disabled={cancelMutation.isPending}
                >
                  Cancelar reserva
                </InlineDangerButton>
              )}
              {reservation.conversationId && (
                <InlineButton
                  onClick={() => setOpenChatId((prev) => (prev === reservation.id ? null : reservation.id))}
                >
                  {openChatId === reservation.id ? 'Fechar conversa' : 'Conversar'}
                </InlineButton>
              )}
            </div>

            {openChatId === reservation.id && reservation.conversationId && (
              <div className="mt-2">
                <ChatPanel conversationId={reservation.conversationId} />
              </div>
            )}
          </article>
        ))}
      </div>
    </QueryState>
  );
}
