import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  CATEGORY_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  DONATION_LIST_STATUS_LABEL,
  fetchDonation,
} from '../lib/donations';
import { formatDateTime, formatQuantity } from '../lib/format';
import { AppHeader } from '../components/layout/AppHeader';
import { QueryState } from '../components/ui/QueryState';
import { ReserveDonationListForm } from '../components/ReserveDonationListForm';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link to="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Voltar ao painel
        </Link>

        <div className="mt-4">
          <QueryState
            isLoading={query.isLoading}
            isError={query.isError}
            error={query.error}
            onRetry={() => query.refetch()}
          >
            {donationList && (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="font-display text-2xl font-medium text-neutral-900 dark:text-white">
                      {donationList.items.map((i) => i.foodName).join(', ')}
                    </h1>
                    {donationList.donorOrganization && (
                      <p className="mt-1 text-sm text-neutral-500">
                        {donationList.donorOrganization.tradeName} ·{' '}
                        {donationList.donorOrganization.address.city}/{donationList.donorOrganization.address.state}
                        {typeof donationList.donorOrganization.completedPickupCount === 'number' && (
                          <> · {donationList.donorOrganization.completedPickupCount} retirada(s) concluída(s)</>
                        )}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {DONATION_LIST_STATUS_LABEL[donationList.status]}
                  </span>
                </div>

                <p className="mt-3 text-sm text-neutral-500">
                  Retirada até {formatDateTime(donationList.pickupDeadline)} · validade{' '}
                  {formatDateTime(donationList.expiresAt)} ·{' '}
                  {donationList.allowPartial ? 'aceita reserva parcial' : 'só a lista inteira'}
                </p>
                {donationList.notes && (
                  <p className="mt-2 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                    {donationList.notes}
                  </p>
                )}

                <div className="mt-6 flex flex-col gap-3">
                  {donationList.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                    >
                      {item.imageUrl && (
                        <img
                          src={`${API_URL}${item.imageUrl}`}
                          alt={item.foodName}
                          className="h-24 w-24 shrink-0 rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <h2 className="font-semibold text-neutral-900 dark:text-white">{item.foodName}</h2>
                        <p className="text-sm text-neutral-500">
                          {CATEGORY_LABEL[item.category]} ·{' '}
                          {formatQuantity(item.remainingQuantity, item.unit)} de{' '}
                          {formatQuantity(item.quantity, item.unit)} · {DONATION_ITEM_STATUS_LABEL[item.status]}
                        </p>
                        {item.description && <p className="mt-1 text-sm text-neutral-500">{item.description}</p>}
                        {item.allergens && (
                          <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                            Alergênicos: {item.allergens}
                          </p>
                        )}
                        {item.storageCondition && (
                          <p className="mt-1 text-xs text-neutral-500">Conservação: {item.storageCondition}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {user?.role === 'NGO' && donationList.status === 'OPEN' && (
                  <div className="mt-6">
                    <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Reservar</h2>
                    <ReserveDonationListForm donationList={donationList} />
                  </div>
                )}
              </>
            )}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
