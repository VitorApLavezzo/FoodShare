import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  CATEGORY_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  DONATION_LIST_STATUS_LABEL,
  fetchDonation,
  type DonationList,
} from '../lib/donations';
import { formatDateTime, formatQuantity } from '../lib/format';
import { AppHeader } from '../components/layout/AppHeader';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { QueryState } from '../components/ui/QueryState';
import { ReserveDonationListForm } from '../components/ReserveDonationListForm';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const STATUS_TONE: Record<DonationList['status'], BadgeTone> = {
  OPEN: 'leaf',
  FULLY_RESERVED: 'sun',
  CLOSED: 'dusk',
  CANCELLED: 'stone',
  EXPIRED: 'stone',
};

/**
 * Tela de detalhe da doação. O endpoint existia desde o início e nenhuma tela
 * chamava: sem ela, as notificações não tinham para onde levar e não havia como
 * compartilhar o link de uma doação específica.
 */
export function DonationDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['donation', id],
    queryFn: () => fetchDonation(id),
  });

  const donationList = query.data;

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 pt-8 pb-20">
        <Link to="/dashboard" className="self-start text-sm font-semibold text-ink-muted hover:text-leaf-800">
          ← Voltar ao painel
        </Link>

        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          onRetry={() => query.refetch()}
        >
          {donationList && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="font-display text-[2.125rem] leading-[1.1] font-semibold text-leaf-800">
                    {donationList.items.map((i) => i.foodName).join(', ')}
                  </h1>
                  {donationList.donorOrganization && (
                    <p className="mt-1.5 text-[15px] text-ink-muted">
                      {donationList.donorOrganization.tradeName} ·{' '}
                      {donationList.donorOrganization.address.city}/
                      {donationList.donorOrganization.address.state}
                      {typeof donationList.donorOrganization.completedPickupCount === 'number' && (
                        <> · {donationList.donorOrganization.completedPickupCount} retirada(s) concluída(s)</>
                      )}
                    </p>
                  )}
                </div>
                <Badge tone={STATUS_TONE[donationList.status]}>
                  {DONATION_LIST_STATUS_LABEL[donationList.status]}
                </Badge>
              </div>

              <p className="text-sm text-ink-soft">
                Retirada até {formatDateTime(donationList.pickupDeadline)} · validade{' '}
                {formatDateTime(donationList.expiresAt)} ·{' '}
                {donationList.allowPartial ? 'aceita reserva parcial' : 'só a lista inteira'}
              </p>

              {/* Recado do doador em âmbar: é instrução prática para a retirada
                  (porta lateral, recipiente térmico), não descrição do alimento. */}
              {donationList.notes && (
                <p className="rounded-2xl bg-sun-50 px-4 py-3.5 text-sm leading-relaxed text-sun-900">
                  {donationList.notes}
                </p>
              )}

              <div className="flex flex-col gap-3">
                {donationList.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 rounded-[22px] border border-line bg-surface px-5 py-4.5"
                  >
                    {item.imageUrl && (
                      <img
                        src={`${API_URL}${item.imageUrl}`}
                        alt={item.foodName}
                        className="h-24 w-24 shrink-0 rounded-2xl object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-[17px] font-bold text-ink">{item.foodName}</h2>
                      <p className="text-sm text-ink-muted">
                        {CATEGORY_LABEL[item.category]} · {formatQuantity(item.remainingQuantity, item.unit)}{' '}
                        de {formatQuantity(item.quantity, item.unit)} ·{' '}
                        {DONATION_ITEM_STATUS_LABEL[item.status]}
                      </p>
                      {item.description && <p className="mt-0.5 text-sm text-ink-soft">{item.description}</p>}
                      {item.allergens && (
                        <p className="mt-0.5 text-sm font-semibold text-sun-700">
                          Alergênicos: {item.allergens}
                        </p>
                      )}
                      {item.storageCondition && (
                        <p className="mt-0.5 text-xs text-ink-muted">Conservação: {item.storageCondition}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {user?.role === 'NGO' && donationList.status === 'OPEN' && (
                <ReserveDonationListForm donationList={donationList} />
              )}
            </>
          )}
        </QueryState>
      </div>
    </div>
  );
}
