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
// Os gráficos do admin ainda são a dependência mais pesada da tela e ficam
// abaixo do conteúdo principal — carregar sob demanda encurta o primeiro render.
const DonorMetrics = lazy(() =>
  import('../components/dashboard/DonorMetrics').then((m) => ({ default: m.DonorMetrics })),
);
const NgoMetrics = lazy(() =>
  import('../components/dashboard/NgoMetrics').then((m) => ({ default: m.NgoMetrics })),
);
const AdminMetrics = lazy(() =>
  import('../components/dashboard/AdminMetrics').then((m) => ({ default: m.AdminMetrics })),
);
import { AuditLogList } from '../components/dashboard/AuditLogList';
import { NodesSyncPanel } from '../components/dashboard/NodesSyncPanel';
import { AppHeader } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { Badge, type BadgeTone } from '../components/ui/Badge';

const APPROVAL_TONE: Record<Organization['approvalStatus'], BadgeTone> = {
  PENDING: 'sun',
  APPROVED: 'leaf',
  REJECTED: 'danger',
  BLOCKED: 'stone',
};

// A saudação muda com o papel porque o que a pessoa vem fazer aqui é diferente:
// o doador vem oferecer, a ONG vem procurar.
const GREETING: Record<string, string> = {
  DONOR: 'Bora compartilhar hoje?',
  NGO: 'Tem comida boa esperando.',
  ADMIN: 'Como anda a rede hoje?',
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

  const organization = organizationQuery.data;

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 pt-10 pb-20">
        <h1 className="font-display text-[2.125rem] leading-tight font-semibold text-leaf-800">
          Oi, {user.name.split(' ')[0]}! <span className="text-sun-500">{GREETING[user.role]}</span>
        </h1>

        {user.role === 'ADMIN' && (
          <>
            <Suspense fallback={<p className="text-sm text-ink-muted">Carregando indicadores…</p>}>
              <AdminMetrics />
            </Suspense>
            <NodesSyncPanel />
            <AuditLogList />
          </>
        )}

        {(user.role === 'DONOR' || user.role === 'NGO') && (
          <>
            {organization?.approvalStatus === 'APPROVED' && (
              <Suspense fallback={<p className="text-sm text-ink-muted">Carregando indicadores…</p>}>
                {user.role === 'DONOR' ? <DonorMetrics /> : <NgoMetrics />}
              </Suspense>
            )}

            {organizationQuery.isLoading && <p className="text-sm text-ink-muted">Carregando cadastro…</p>}

            {organization && (
              <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-[22px] font-semibold text-leaf-800">
                      {organization.tradeName}
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-muted">{organization.legalName}</p>
                  </div>
                  <Badge tone={APPROVAL_TONE[organization.approvalStatus]}>
                    {APPROVAL_LABEL[organization.approvalStatus]}
                  </Badge>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-semibold text-ink-muted">Endereço</dt>
                    <dd className="mt-0.5 text-ink-body">
                      {organization.address.street}
                      {organization.address.number ? `, ${organization.address.number}` : ''},{' '}
                      {organization.address.city}/{organization.address.state}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink-muted">Contato</dt>
                    <dd className="mt-0.5 text-ink-body">
                      {organization.phone} · {organization.email}
                    </dd>
                  </div>
                </dl>
              </section>
            )}

            {organizationQuery.isSuccess && !organization && (
              <section className="rounded-3xl border border-line bg-surface p-6">
                <h2 className="font-display text-[22px] font-semibold text-leaf-800">
                  {kind === 'NGO' ? 'Cadastre sua ONG' : 'Cadastre seu estabelecimento'}
                </h2>
                <p className="mt-1 mb-6 text-sm text-ink-muted">
                  Leva menos de um minuto — assim que salvar, já dá pra{' '}
                  {kind === 'NGO' ? 'reservar doações' : 'publicar doações'}.
                </p>
                <OrganizationForm
                  kind={kind}
                  onCreated={() => queryClient.invalidateQueries({ queryKey: ['my-organization', kind] })}
                />
              </section>
            )}

            {user.role === 'DONOR' && organization?.approvalStatus === 'APPROVED' && (
              <>
                <section className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-[22px] font-semibold text-leaf-800">Minhas doações</h2>
                    <Button onClick={() => setShowDonationForm((prev) => !prev)}>
                      {showDonationForm ? 'Fechar' : 'Nova doação'}
                    </Button>
                  </div>

                  {showDonationForm && (
                    <div className="rounded-3xl border border-line bg-surface p-6">
                      <DonationForm
                        onCreated={() => {
                          setShowDonationForm(false);
                          queryClient.invalidateQueries({ queryKey: ['donations'] });
                        }}
                      />
                    </div>
                  )}

                  <DonationsList mode="own" />
                </section>

                <DonationTemplatesPanel />

                <section className="flex flex-col gap-4">
                  <h2 className="font-display text-[22px] font-semibold text-leaf-800">Reservas recebidas</h2>
                  <ReservationsList />
                </section>
              </>
            )}

            {user.role === 'NGO' && (
              <>
                <section className="flex flex-col gap-4">
                  <h2 className="font-display text-[22px] font-semibold text-leaf-800">
                    Doações disponíveis
                  </h2>
                  <DonationsList mode="available" />
                </section>

                <section className="flex flex-col gap-4">
                  <h2 className="font-display text-[22px] font-semibold text-leaf-800">Minhas reservas</h2>
                  <ReservationsList />
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
