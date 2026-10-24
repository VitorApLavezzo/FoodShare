import { useId, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ORGANIZATION_TYPE_LABEL, RESERVATION_STATUS_LABEL } from '@foodshare/types';
import {
  CATEGORY_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  DONATION_LIST_STATUS_LABEL,
  fetchDonation,
  type DonationItem,
  type DonationList,
} from '../lib/donations';
import { cancelReservation, fetchReservations, type Reservation } from '../lib/reservations';
import { formatDateTime, formatQuantity, isDeadlineClose, timeUntil } from '../lib/format';
import { directionsUrl, formatAddress } from '../lib/address';
import { getApiErrorMessage } from '../lib/api';
import { AppHeader } from '../components/layout/AppHeader';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { ButtonLink, InlineDangerButton } from '../components/ui/Button';
import { QueryState } from '../components/ui/QueryState';
import { ReservePanel } from '../components/ReservePanel';
import { useReserveDonation, type ItemSelection, type ReserveDonation } from '../lib/use-reserve-donation';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const STATUS_TONE: Record<DonationList['status'], BadgeTone> = {
  OPEN: 'leaf',
  FULLY_RESERVED: 'sun',
  CLOSED: 'dusk',
  CANCELLED: 'stone',
  EXPIRED: 'stone',
};

const RESERVATION_TONE: Record<Reservation['status'], BadgeTone> = {
  ACTIVE: 'leaf',
  CANCELLED: 'stone',
  COMPLETED: 'dusk',
  EXPIRED: 'sun',
};

/** Título curto mesmo para listas grandes: os três primeiros e "e mais N". */
function itemsTitle(items: DonationItem[]) {
  const names = items.map((item) => item.foodName);
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 3).join(', ')} e mais ${names.length - 3}`;
}

/* Ícones da coluna de retirada: ajudam a achar "onde" e "quando" de relance. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
const PinIcon = () => (
  <Icon>
    <path d="M10 18s-6-5.3-6-10a6 6 0 1 1 12 0c0 4.7-6 10-6 10z" />
    <circle cx="10" cy="8" r="2.2" />
  </Icon>
);
const ClockIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6v4l2.5 2.5" />
  </Icon>
);
const CalendarIcon = () => (
  <Icon>
    <rect x="3.5" y="4.5" width="13" height="12" rx="2" />
    <path d="M3.5 8.5h13M7 2.5v4M13 2.5v4" />
  </Icon>
);

function InfoRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0 text-leaf-600">{icon}</span>
      <div className="min-w-0 text-sm text-ink-soft">
        <p className="text-xs font-bold tracking-[0.04em] text-ink-muted uppercase">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

/**
 * Onde, até quando e o recado do doador. Antes era uma linha cinza com a
 * cidade e duas datas — o endereço de retirada nem aparecia.
 */
function PickupCard({ donationList }: { donationList: DonationList }) {
  const donor = donationList.donorOrganization;
  const isOpen = donationList.status === 'OPEN';
  const notYetAvailable = new Date(donationList.availableAt).getTime() > Date.now();
  const urgent = isOpen && isDeadlineClose(donationList.pickupDeadline);

  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
      <h2 className="font-display text-xl font-semibold text-leaf-800">Retirada</h2>

      {donor && (
        <InfoRow icon={<PinIcon />} label="Onde">
          <span className="font-semibold text-ink">{donor.tradeName}</span>
          <span className="block">{formatAddress(donor.address)}</span>
          <a
            href={directionsUrl(donor.address)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block font-semibold text-leaf-600 hover:underline"
          >
            Como chegar ↗
          </a>
        </InfoRow>
      )}

      <InfoRow icon={<ClockIcon />} label="Retirar até">
        <span className="font-semibold text-ink">{formatDateTime(donationList.pickupDeadline)}</span>
        {isOpen && (
          <span
            className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
              urgent ? 'bg-danger-50 text-danger' : 'bg-sun-100 text-sun-800'
            }`}
          >
            {timeUntil(donationList.pickupDeadline)}
          </span>
        )}
        {notYetAvailable && (
          <span className="block text-ink-muted">A partir de {formatDateTime(donationList.availableAt)}</span>
        )}
        {donor?.operatingHours && (
          <span className="block text-ink-muted">Funcionamento: {donor.operatingHours}</span>
        )}
      </InfoRow>

      <InfoRow icon={<CalendarIcon />} label="Validade do alimento">
        {formatDateTime(donationList.expiresAt)}
      </InfoRow>

      {/* Recado do doador em âmbar: é instrução prática para a retirada
          (porta lateral, recipiente térmico), não descrição do alimento. */}
      {donationList.notes && (
        <div className="rounded-2xl bg-sun-50 px-4 py-3 text-sm leading-relaxed text-sun-900">
          <p className="text-xs font-bold tracking-[0.04em] uppercase">Recado do doador</p>
          <p className="mt-0.5">{donationList.notes}</p>
        </div>
      )}

      {donor && (
        <p className="border-t border-line pt-3 text-[13px] text-ink-muted">
          {donor.type ? ORGANIZATION_TYPE_LABEL[donor.type] : 'Estabelecimento doador'} ·{' '}
          {donor.completedPickupCount
            ? `${donor.completedPickupCount} ${donor.completedPickupCount === 1 ? 'retirada concluída' : 'retiradas concluídas'} na plataforma`
            : 'ainda sem retiradas concluídas na plataforma'}
        </p>
      )}
    </section>
  );
}

/**
 * Card do item. Quando a reserva é por item, o próprio card é a caixa de
 * seleção — antes os itens apareciam aqui e de novo numa lista de checkboxes
 * no formulário, e a ONG tinha de cruzar as duas.
 */
function ItemCard({
  item,
  selection,
  reserve,
}: {
  item: DonationItem;
  selection?: ItemSelection;
  reserve?: ReserveDonation;
}) {
  const quantityId = useId();
  const available = item.status === 'AVAILABLE';
  const selectable = !!reserve && available;
  const selected = selectable && !!selection?.selected;
  const leftover = item.remainingQuantity < item.quantity;

  const body = (
    <>
      {item.imageUrl && (
        <img
          src={`${API_URL}${item.imageUrl}`}
          alt={item.foodName}
          className="h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-[17px] font-bold text-ink">{item.foodName}</h3>
          {!available && <Badge tone="stone">{DONATION_ITEM_STATUS_LABEL[item.status]}</Badge>}
        </div>
        <p className="text-sm text-ink-muted">
          {CATEGORY_LABEL[item.category]} ·{' '}
          {available && leftover
            ? `${formatQuantity(item.remainingQuantity, item.unit)} disponíveis de ${formatQuantity(item.quantity, item.unit)}`
            : formatQuantity(item.quantity, item.unit)}
        </p>
        {item.description && <p className="mt-1 text-sm text-ink-soft">{item.description}</p>}
        {item.allergens && (
          <p className="mt-1 text-sm font-semibold text-sun-700">⚠ Alergênicos: {item.allergens}</p>
        )}
        {item.storageCondition && (
          <p className="mt-0.5 text-xs text-ink-muted">Conservação: {item.storageCondition}</p>
        )}
      </div>
    </>
  );

  if (!selectable) {
    return (
      <div
        className={`flex gap-4 rounded-[22px] border border-line bg-surface px-5 py-4 ${available ? '' : 'opacity-60'}`}
      >
        {body}
      </div>
    );
  }

  const quantity = Number(selection?.quantity);

  return (
    <div
      className={`overflow-hidden rounded-[22px] border-2 transition ${
        selected ? 'border-leaf-600 bg-leaf-50' : 'border-line bg-surface hover:border-line-bold'
      }`}
    >
      <label className="flex cursor-pointer gap-4 px-5 py-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => reserve.toggle(item.id)}
          className="mt-1 h-5 w-5 shrink-0 accent-leaf-800"
          aria-label={`Reservar ${item.foodName}`}
        />
        {body}
      </label>

      {selected && (
        <div className="flex flex-wrap items-center gap-2 border-t border-leaf-200 bg-surface/60 px-5 py-3 text-sm">
          <label htmlFor={quantityId} className="font-semibold text-ink-body">
            Quanto vai levar
          </label>
          <input
            id={quantityId}
            type="number"
            min={0}
            max={item.remainingQuantity}
            step="any"
            value={selection?.quantity ?? ''}
            onChange={(e) => reserve.setQuantity(item.id, e.target.value)}
            className="w-24 rounded-full border-[1.5px] border-line-strong bg-surface px-3 py-1.5 text-sm text-ink transition focus:border-leaf-600 focus:ring-4 focus:ring-leaf-600/20 focus:outline-none"
          />
          <span className="text-ink-muted">
            {item.unit} de {formatQuantity(item.remainingQuantity, item.unit)}
          </span>
          {quantity !== item.remainingQuantity && (
            <button
              type="button"
              onClick={() => reserve.setQuantity(item.id, String(item.remainingQuantity))}
              className="rounded-sm font-semibold text-leaf-600 hover:underline"
            >
              Levar tudo
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A reserva desta ONG nesta doação. Antes o código aparecia num aviso de
 * quatro segundos e nada dizia o que fazer em seguida; agora é o primeiro bloco
 * da página, com o código grande e os próximos passos.
 */
function MyReservationCard({
  reservation,
  donationList,
  onCancel,
  cancelling,
}: {
  reservation: Reservation;
  donationList: DonationList;
  onCancel: (reservation: Reservation) => void;
  cancelling: boolean;
}) {
  const donor = donationList.donorOrganization;
  const items = reservation.items
    .map(
      (i) => `${i.donationItem?.foodName ?? ''} (${formatQuantity(i.quantity, i.donationItem?.unit ?? '')})`,
    )
    .join(', ');

  if (reservation.status !== 'ACTIVE') {
    const message =
      reservation.status === 'COMPLETED'
        ? 'Retirada concluída. Obrigado por buscar!'
        : reservation.status === 'CANCELLED'
          ? 'Esta reserva foi cancelada.'
          : 'O prazo passou sem a retirada.';
    return (
      <section className="flex flex-col gap-1.5 rounded-3xl border border-line bg-surface px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-ink">Sua reserva</h2>
          <Badge tone={RESERVATION_TONE[reservation.status]}>
            {RESERVATION_STATUS_LABEL[reservation.status]}
          </Badge>
        </div>
        <p className="text-sm text-ink-soft">{message}</p>
        <p className="text-[13px] text-ink-muted">{items}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-3xl border-2 border-leaf-600 bg-leaf-50 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[22px] font-semibold text-leaf-800">✓ Reserva confirmada</h2>
        <Badge tone="leaf">Ativa</Badge>
      </div>

      <div className="rounded-2xl bg-surface px-4 py-4 text-center">
        <p className="text-xs font-bold tracking-[0.06em] text-ink-muted uppercase">Código de retirada</p>
        <p className="mt-1 font-mono text-[34px] leading-none font-bold tracking-[0.3em] text-sun-800">
          {reservation.pickupCode}
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Mostre este código para quem atender{donor ? ` no ${donor.tradeName}` : ''}.
        </p>
      </div>

      <ol className="flex flex-col gap-2.5 text-sm text-ink-body">
        <li className="flex gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-800 text-xs font-bold text-canvas">
            1
          </span>
          <span>
            Vá até <strong>{donor?.tradeName ?? 'o doador'}</strong>
            {donor && <> ({formatAddress(donor.address)})</>} até{' '}
            <strong>{formatDateTime(donationList.pickupDeadline)}</strong> —{' '}
            {timeUntil(donationList.pickupDeadline)}.
            {donor && (
              <>
                {' '}
                <a
                  href={directionsUrl(donor.address)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-leaf-600 hover:underline"
                >
                  Como chegar ↗
                </a>
              </>
            )}
          </span>
        </li>
        <li className="flex gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-800 text-xs font-bold text-canvas">
            2
          </span>
          <span>Mostre o código. É com ele que o doador confirma a retirada.</span>
        </li>
        <li className="flex gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-800 text-xs font-bold text-canvas">
            3
          </span>
          <span>
            Imprevisto? Avise o doador pela conversa ou cancele a reserva, para os itens voltarem para outras
            ONGs.
          </span>
        </li>
      </ol>

      <p className="text-[13px] text-ink-muted">
        Você reservou: {items}
        {donor?.phone && <> · Telefone do doador: {donor.phone}</>}
        {/* Cada ONG tem uma reserva por doação; mudar é cancelar e refazer. */}
        {donationList.allowPartial && (
          <span className="mt-1 block">
            Quer levar mais ou menos? Cancele esta reserva e reserve de novo com o que precisa.
          </span>
        )}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {reservation.conversationId && (
          <ButtonLink to={`/dashboard?conversa=${reservation.conversationId}`}>
            Conversar com o doador
          </ButtonLink>
        )}
        <ButtonLink to="/dashboard#minhas-reservas" variant="secondary">
          Minhas reservas
        </ButtonLink>
        <InlineDangerButton onClick={() => onCancel(reservation)} disabled={cancelling}>
          Cancelar reserva
        </InlineDangerButton>
      </div>
    </section>
  );
}

function DonationDetail({
  donationList,
  myReservations,
}: {
  donationList: DonationList;
  myReservations: Reservation[];
}) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const isNgo = user?.role === 'NGO';

  const reserve = useReserveDonation(donationList);
  // Uma reserva ativa por ONG em cada doação (regra também da API): com uma já
  // feita, a tela mostra a reserva, não um formulário para outra.
  const hasActiveReservation = myReservations.some((r) => r.status === 'ACTIVE');
  const canReserve =
    isNgo && donationList.status === 'OPEN' && reserve.availableItems.length > 0 && !hasActiveReservation;
  // Lista que só sai inteira não tem o que escolher: os cards ficam sem caixa.
  const picking = canReserve && donationList.allowPartial;
  const allSelected = reserve.selectedItems.length === reserve.availableItems.length;

  const cancelMutation = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['donation', donationList.id] });
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['map'] });
      showToast('Reserva cancelada. Os itens voltaram a ficar disponíveis.', 'info');
    },
    onError: (err) => showToast(getApiErrorMessage(err, 'Não foi possível cancelar a reserva.'), 'error'),
  });

  const confirmCancel = (reservation: Reservation) => {
    if (!window.confirm('Cancelar esta reserva? Os itens voltam a ficar disponíveis para outras ONGs.'))
      return;
    cancelMutation.mutate(reservation.id);
  };

  const donor = donationList.donorOrganization;
  const itemCount = donationList.items.length;

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={STATUS_TONE[donationList.status]}>
            {DONATION_LIST_STATUS_LABEL[donationList.status]}
          </Badge>
          <Badge tone="stone">
            {donationList.allowPartial ? 'Aceita reserva parcial' : 'Só a lista inteira'}
          </Badge>
        </div>
        <h1 className="font-display text-[2.125rem] leading-[1.1] font-semibold text-leaf-800">
          {itemsTitle(donationList.items)}
        </h1>
        {donor && (
          <p className="text-[15px] text-ink-muted">
            {donor.tradeName} · {donor.address.city}/{donor.address.state}
          </p>
        )}
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          {isNgo &&
            myReservations.map((reservation) => (
              <MyReservationCard
                key={reservation.id}
                reservation={reservation}
                donationList={donationList}
                onCancel={confirmCancel}
                cancelling={cancelMutation.isPending}
              />
            ))}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h2 className="font-display text-xl font-semibold text-leaf-800">
                O que tem nesta doação
                <span className="font-sans text-base font-normal text-ink-muted">
                  {' '}
                  · {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                </span>
              </h2>
              {picking && reserve.availableItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => reserve.setAll(!allSelected)}
                  className="rounded-sm text-sm font-semibold text-leaf-600 hover:underline"
                >
                  {allSelected ? 'Desmarcar todos' : 'Marcar todos'}
                </button>
              )}
            </div>
            {picking && <p className="-mt-1 text-sm text-ink-muted">Marque os itens que vai buscar.</p>}

            {donationList.items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                selection={reserve.selections[item.id]}
                reserve={picking ? reserve : undefined}
              />
            ))}
          </section>
        </div>

        {/* No computador a coluna acompanha a rolagem, com o botão sempre à
            vista. No celular a retirada vem antes do botão: primeiro onde e
            quando, depois a decisão. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
          {canReserve && (
            <div className="order-2 lg:order-1">
              <ReservePanel donationList={donationList} reserve={reserve} />
            </div>
          )}

          <div className="order-1 lg:order-2">
            <PickupCard donationList={donationList} />
          </div>

          {isNgo && !canReserve && !hasActiveReservation && (
            <p className="order-3 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-ink-soft">
              Esta doação não está mais disponível para reserva.
            </p>
          )}

          {/* Só o dono enxerga a própria doação como doador; editar e
              cancelar moram no painel, junto das reservas recebidas. */}
          {user?.role === 'DONOR' && (
            <div className="order-3 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
              <p className="text-sm text-ink-soft">
                Esta doação é sua. Edite, cancele ou confirme retiradas pelo painel.
              </p>
              <ButtonLink to="/dashboard" variant="secondary" className="self-start">
                Gerenciar no painel
              </ButtonLink>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/**
 * Tela de detalhe da doação — para a ONG, é a tela de reserva. O endpoint
 * existia desde o início e nenhuma tela chamava: sem ela, as notificações não
 * tinham para onde levar e não havia como compartilhar o link de uma doação.
 */
export function DonationDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isNgo = user?.role === 'NGO';

  const query = useQuery({
    queryKey: ['donation', id],
    queryFn: () => fetchDonation(id),
  });

  const reservationsQuery = useQuery({
    queryKey: ['reservations'],
    queryFn: fetchReservations,
    enabled: isNgo,
  });

  // A ativa primeiro: é a que pede ação.
  const myReservations = (reservationsQuery.data ?? [])
    .filter((r) => r.donationListId === id)
    .sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE'));

  // Volta para onde a pessoa estava (mapa, sino, lista) — o link fixo para o
  // painel jogava fora o contexto de quem chegou pelo mapa. Sem histórico
  // (link aberto direto), cai no painel.
  const canGoBack = location.key !== 'default';

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pt-8 pb-20">
        {canGoBack ? (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="self-start text-sm font-semibold text-ink-muted hover:text-leaf-800"
          >
            ← Voltar
          </button>
        ) : (
          <Link
            to="/dashboard"
            className="self-start text-sm font-semibold text-ink-muted hover:text-leaf-800"
          >
            ← Ir para o painel
          </Link>
        )}

        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
        >
          {query.data && <DonationDetail donationList={query.data} myReservations={myReservations} />}
        </QueryState>
      </div>
    </div>
  );
}
