import { lazy, Suspense, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { APPROVAL_STATUS_LABEL as APPROVAL_LABEL } from '@foodshare/types';
import { useAuth } from '../context/AuthContext';
import { fetchMyOrganization, type Organization } from '../lib/organizations';
import { OrganizationForm } from '../components/OrganizationForm';
import { DonationForm } from '../components/DonationForm';
import { DonationsList } from '../components/DonationsList';
import { ReservationsList } from '../components/ReservationsList';
import { DonationTemplatesPanel } from '../components/DonationTemplatesPanel';
// Os gráficos (recharts) são a dependência mais pesada da tela e ficam abaixo
// do conteúdo principal — carregar sob demanda encurta o primeiro render.
const DonorMetrics = lazy(() =>
  import('../components/dashboard/DonorMetrics').then((m) => ({ default: m.DonorMetrics })),
);
const NgoMetrics = lazy(() => import('../components/dashboard/NgoMetrics').then((m) => ({ default: m.NgoMetrics })));
const AdminMetrics = lazy(() =>
  import('../components/dashboard/AdminMetrics').then((m) => ({ default: m.AdminMetrics })),
);
import { AuditLogList } from '../components/dashboard/AuditLogList';
import { NodesSyncPanel } from '../components/dashboard/NodesSyncPanel';
import { AppHeader } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';

const APPROVAL_BADGE: Record<Organization['approvalStatus'], string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  APPROVED: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
  BLOCKED: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
};

export function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const kind = user?.role === 'NGO' ? 'NGO' : 'DONOR';
  const [showDonationForm, setShowDonationForm] = useState(false);

  const organizationQuery = useQuery({
    queryKey: ['my-organization', kind],
    queryFn: () => fetchMyOrganization(kind),
    enabled: user?.role === 'DONOR' || user?.role === 'NGO',
  });

  if (!user) return null;

  return (
    <div>
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-display text-2xl font-medium text-neutral-900 dark:text-white">
          Olá, {user.name.split(' ')[0]} 👋
        </h1>

        {user.role === 'ADMIN' && (
          <div className="mt-8">
            <Suspense fallback={<p className="text-sm text-neutral-500">Carregando indicadores…</p>}>
              <AdminMetrics />
            </Suspense>
            <NodesSyncPanel />
            <AuditLogList />
          </div>
        )}

        {(user.role === 'DONOR' || user.role === 'NGO') && (
          <div className="mt-8">
            {organizationQuery.data?.approvalStatus === 'APPROVED' && (
              <Suspense fallback={<p className="text-sm text-neutral-500">Carregando indicadores…</p>}>
                {user.role === 'DONOR' ? <DonorMetrics /> : <NgoMetrics />}
              </Suspense>
            )}

            {organizationQuery.isLoading && <p className="text-sm text-neutral-500">Carregando cadastro…</p>}

            {organizationQuery.data && (
              <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                      {organizationQuery.data.tradeName}
                    </h2>
                    <p className="text-sm text-neutral-500">{organizationQuery.data.legalName}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${APPROVAL_BADGE[organizationQuery.data.approvalStatus]}`}
                  >
                    {APPROVAL_LABEL[organizationQuery.data.approvalStatus]}
                  </span>
                </div>
                <dl className="mt-4 grid gap-2 text-sm text-neutral-600 dark:text-neutral-400 sm:grid-cols-2">
                  <div>
                    <dt className="font-medium text-neutral-500">Endereço</dt>
                    <dd>
                      {organizationQuery.data.address.street}, {organizationQuery.data.address.city}/
                      {organizationQuery.data.address.state}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-neutral-500">Contato</dt>
                    <dd>
                      {organizationQuery.data.phone} · {organizationQuery.data.email}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {organizationQuery.isSuccess && !organizationQuery.data && (
              <div className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {kind === 'NGO' ? 'Cadastre sua ONG' : 'Cadastre seu estabelecimento'}
                </h2>
                <p className="mt-1 mb-6 text-sm text-neutral-500">
                  Leva menos de um minuto — assim que salvar, já pode {kind === 'NGO' ? 'reservar doações' : 'publicar doações'}.
                </p>
                <OrganizationForm
                  kind={kind}
                  onCreated={() => queryClient.invalidateQueries({ queryKey: ['my-organization', kind] })}
                />
              </div>
            )}

            {user.role === 'DONOR' && organizationQuery.data?.approvalStatus === 'APPROVED' && (
              <div className="mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Minhas doações</h2>
                  <Button size="sm" onClick={() => setShowDonationForm((prev) => !prev)}>
                    {showDonationForm ? 'Fechar' : 'Nova doação'}
                  </Button>
                </div>

                {showDonationForm && (
                  <div className="mt-4 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
                    <DonationForm
                      onCreated={() => {
                        setShowDonationForm(false);
                        queryClient.invalidateQueries({ queryKey: ['donations'] });
                      }}
                    />
                  </div>
                )}

                <div className="mt-4">
                  <DonationsList mode="own" />
                </div>

                <div className="mt-8">
                  <DonationTemplatesPanel />
                </div>

                <div className="mt-8">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Reservas recebidas</h2>
                  <div className="mt-4">
                    <ReservationsList />
                  </div>
                </div>
              </div>
            )}

            {user.role === 'NGO' && (
              <>
                <div className="mt-8">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Doações disponíveis</h2>
                  <div className="mt-4">
                    <DonationsList mode="available" />
                  </div>
                </div>

                <div className="mt-8">
                  <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Minhas reservas</h2>
                  <div className="mt-4">
                    <ReservationsList />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
