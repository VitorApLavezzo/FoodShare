import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelDonation,
  fetchDonations,
  CATEGORY_LABEL,
  DONATION_LIST_STATUS_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  type DonationList,
} from '../lib/donations';
import { confirmPickup, fetchReservations } from '../lib/reservations';
import { getApiErrorMessage } from '../lib/api';
import { formatDateTime, formatQuantity } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { Button, ButtonLink, InlineDangerButton } from './ui/Button';
import { Badge, type BadgeTone } from './ui/Badge';
import { QueryState } from './ui/QueryState';
import { EditDonationListForm } from './EditDonationListForm';
import { DonationFilters, type DonationFilterValues } from './DonationFilters';

/**
 * Painel âmbar, e não mais um cartão neutro: a confirmação de retirada é a
 * única coisa nesta tela que acontece com a ONG parada na porta esperando.
 */
function ConfirmPickupForm() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Mesma chave da lista de reservas: não gera requisição a mais.
  const reservationsQuery = useQuery({ queryKey: ['reservations'], queryFn: fetchReservations });
  const hasActiveReservation = (reservationsQuery.data ?? []).some((r) => r.status === 'ACTIVE');

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

  // Sem reserva ativa não há ONG a caminho: o painel âmbar chamando atenção
  // para um código que ninguém tem só confundia quem acabou de publicar.
  if (!hasActiveReservation && !mutation.isPending) return null;

  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-sun-50 px-4.5 py-4">
      <p className="text-[13px] font-semibold text-sun-800">
        A ONG chegou? Digite o código que ela mostrar pra confirmar a retirada.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(code.toUpperCase());
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\s/g, '').toUpperCase())}
          maxLength={6}
          autoComplete="off"
          placeholder="Código"
          aria-label="Código de retirada apresentado pela ONG"
          className="w-[150px] rounded-full border-[1.5px] border-sun-300 bg-surface px-4 py-2 font-mono text-[15px] tracking-[0.15em] text-ink uppercase transition placeholder:tracking-normal placeholder:text-ink-faint focus:border-sun-500 focus:ring-4 focus:ring-sun-500/20 focus:outline-none"
        />
        <Button type="submit" variant="accent" loading={mutation.isPending} disabled={code.length !== 6}>
          Confirmar retirada
        </Button>
        {error && (
          <p role="alert" className="w-full text-sm font-semibold text-danger">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

const STATUS_TONE: Record<DonationList['status'], BadgeTone> = {
  OPEN: 'leaf',
  FULLY_RESERVED: 'sun',
  CLOSED: 'dusk',
  CANCELLED: 'stone',
  EXPIRED: 'stone',
};

export function DonationsList({ mode }: { mode: 'own' | 'available' }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DonationFilterValues>({});
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['donations', mode, filters, page],
    queryFn: () => fetchDonations({ ...filters, page }),
  });

  // Doações em que a ONG já tem reserva ativa: o botão leva à reserva, não a
  // um formulário que a API recusaria (uma reserva ativa por ONG em cada doação).
  const reservationsQuery = useQuery({
    queryKey: ['reservations'],
    queryFn: fetchReservations,
    enabled: mode === 'available',
  });
  const reservedListIds = new Set(
    (reservationsQuery.data ?? []).filter((r) => r.status === 'ACTIVE').map((r) => r.donationListId),
  );

  const hasFilters = !!(filters.search || filters.category || filters.city);
  const total = query.data?.total ?? 0;
  const limit = query.data?.limit ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const cancelMutation = useMutation({
    mutationFn: cancelDonation,
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      showToast('Doação cancelada.', 'info');
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível cancelar a doação.')),
  });

  const confirmCancel = (donationList: DonationList) => {
    const nomes = donationList.items.map((i) => i.foodName).join(', ');
    // Cancelar uma lista já reservada desfaz o combinado com a ONG, que é avisada
    // na hora — o aviso precisa estar no texto, senão o doador descobre depois.
    const temReserva = donationList.items.some((item) => item.remainingQuantity < item.quantity);
    const pergunta = temReserva
      ? `Cancelar a doação de ${nomes}? As reservas já feitas serão desfeitas e as ONGs avisadas.`
      : `Cancelar a doação de ${nomes}? Ela deixa de aparecer para as ONGs.`;
    if (!window.confirm(pergunta)) return;
    cancelMutation.mutate(donationList.id);
  };

  // Doação cancelada some da visão do doador (o cancelamento é definitivo).
  const items = (query.data?.items ?? []).filter(
    (donationList) => mode !== 'own' || donationList.status !== 'CANCELLED',
  );

  return (
    <div className="flex flex-col gap-3">
      {mode === 'own' && <ConfirmPickupForm />}

      {mode === 'available' && (
        <DonationFilters
          value={filters}
          onChange={(next) => {
            // Novo filtro reinicia a paginação: senão o usuário pode cair numa
            // página que não existe mais no resultado filtrado.
            setPage(1);
            setFilters(next);
          }}
        />
      )}

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isEmpty={items.length === 0}
        emptyMessage={
          mode === 'own'
            ? 'Você ainda não publicou nenhuma doação. Clique em "Nova doação" para começar.'
            : hasFilters
              ? 'Nada encontrado com esses filtros. Tente outra categoria ou cidade.'
              : 'Nenhuma doação disponível agora. Avisamos pelo sino quando aparecer algo por perto.'
        }
        onRetry={() => query.refetch()}
      >
        <div className="flex flex-col gap-3">
          {error && (
            <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          {items.map((donationList) => (
            <article
              key={donationList.id}
              className="flex flex-col gap-2.5 rounded-[22px] border border-line bg-surface p-5 transition hover:border-line-bold hover:shadow-[0_6px_20px_rgba(22,82,46,0.07)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-[17px] font-bold text-ink">
                    <Link to={`/doacoes/${donationList.id}`} className="transition hover:text-leaf-600">
                      {donationList.items.map((i) => i.foodName).join(', ')}
                    </Link>
                  </h3>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {donationList.items.length} {donationList.items.length === 1 ? 'item' : 'itens'} ·{' '}
                    {donationList.allowPartial ? 'aceita reserva parcial' : 'só tudo de uma vez'}
                    {donationList.donorOrganization && mode === 'available' && (
                      <>
                        {' '}
                        · {donationList.donorOrganization.tradeName} (
                        {donationList.donorOrganization.address.city})
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {mode === 'available' && reservedListIds.has(donationList.id) && (
                    <Badge tone="ink">Você reservou</Badge>
                  )}
                  <Badge tone={STATUS_TONE[donationList.status]}>
                    {DONATION_LIST_STATUS_LABEL[donationList.status]}
                  </Badge>
                </div>
              </div>

              <ul className="flex flex-col gap-1">
                {donationList.items.map((item) => (
                  <li key={item.id} className="flex items-center gap-2 text-[13px] text-ink-soft">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sun-500" aria-hidden />
                    {item.foodName} — {CATEGORY_LABEL[item.category]} ·{' '}
                    {formatQuantity(item.remainingQuantity, item.unit)} de{' '}
                    {formatQuantity(item.quantity, item.unit)} · {DONATION_ITEM_STATUS_LABEL[item.status]}
                  </li>
                ))}
              </ul>

              <p className="text-[13px] text-ink-muted">
                Retirada até {formatDateTime(donationList.pickupDeadline)} · validade{' '}
                {formatDateTime(donationList.expiresAt)}
              </p>

              {/* Editar só enquanto a lista está aberta (mudar datas do que já foi
                  reservado quebraria o combinado), mas cancelar vale também com
                  tudo reservado: a comida é do doador e um imprevisto não pode
                  deixá-lo preso a uma entrega que não tem como cumprir. */}
              {mode === 'own' &&
                editingId !== donationList.id &&
                (donationList.status === 'OPEN' || donationList.status === 'FULLY_RESERVED') && (
                  <div className="mt-0.5 flex items-center gap-4">
                    {donationList.status === 'OPEN' && (
                      <Button variant="secondary" onClick={() => setEditingId(donationList.id)}>
                        Editar
                      </Button>
                    )}
                    <InlineDangerButton
                      onClick={() => confirmCancel(donationList)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancelar doação
                    </InlineDangerButton>
                  </div>
                )}

              {mode === 'own' && editingId === donationList.id && (
                <EditDonationListForm donationList={donationList} onDone={() => setEditingId(null)} />
              )}

              {/* A reserva mora na tela de detalhe, onde há espaço para escolher
                  item a item — na lista, o cartão só leva até lá. */}
              {mode === 'available' && donationList.status === 'OPEN' && (
                <div className="mt-0.5 flex">
                  {reservedListIds.has(donationList.id) ? (
                    <ButtonLink to={`/doacoes/${donationList.id}`} variant="secondary">
                      Ver minha reserva
                    </ButtonLink>
                  ) : (
                    <ButtonLink to={`/doacoes/${donationList.id}`}>Ver e reservar</ButtonLink>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      </QueryState>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm text-ink-muted">
          <span>
            Página {page} de {totalPages} · {total} {total === 1 ? 'doação' : 'doações'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
