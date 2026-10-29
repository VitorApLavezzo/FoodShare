import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { APPROVAL_STATUS_LABEL as APPROVAL_LABEL } from '@foodshare/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { type Organization } from '../lib/organizations';
import { useMyOrganization } from '../lib/use-my-organization';
import { OrganizationForm } from '../components/OrganizationForm';
import { DonationForm } from '../components/DonationForm';
import { draftFromDonation, type DonationDraft, type DonationList } from '../lib/donations';
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
import { Button, ButtonLink } from '../components/ui/Button';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { QueryState } from '../components/ui/QueryState';

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

/**
 * Sem aprovação, as ações do painel somem — e antes a tela não dizia por quê:
 * o cartão mostrava só a etiqueta "Reprovado" e nenhum próximo passo.
 */
function approvalNotice(status: Organization['approvalStatus'], kind: 'DONOR' | 'NGO') {
  const action = kind === 'NGO' ? 'reservar doações' : 'publicar doações';
  switch (status) {
    case 'PENDING':
      return `Seu cadastro está em análise. Assim que for aprovado, você já pode ${action}.`;
    case 'REJECTED':
      return `Seu cadastro não foi aprovado, então ainda não dá pra ${action}. Revise os dados em "Editar dados" ou fale com a administração.`;
    case 'BLOCKED':
      return `Sua organização está bloqueada e não pode ${action} no momento. Fale com a administração da plataforma.`;
    default:
      return null;
  }
}

export function DashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const [showDonationForm, setShowDonationForm] = useState(false);
  // Doação nova a partir de uma já feita. O `key` remonta o formulário a cada
  // rascunho, para os valores iniciais valerem de novo.
  const [donationDraft, setDonationDraft] = useState<{ key: string; draft: DonationDraft } | null>(null);
  const donationFormRef = useRef<HTMLDivElement>(null);
  const organizationQuery = useMyOrganization();
  const { kind } = organizationQuery;

  const startFromDonation = useCallback((donationList: DonationList) => {
    setDonationDraft({ key: `${donationList.id}-${Date.now()}`, draft: draftFromDonation(donationList) });
    setShowDonationForm(true);
  }, []);

  const closeDonationForm = () => {
    setShowDonationForm(false);
    setDonationDraft(null);
  };

  // "Doar de novo" na tela de detalhe chega aqui com a doação no state da
  // navegação; o state é limpo em seguida para um F5 não reabrir o rascunho.
  const repeatDonation = (location.state as { repeatDonation?: DonationList } | null)?.repeatDonation;
  useEffect(() => {
    if (!repeatDonation) return;
    startFromDonation(repeatDonation);
    navigate(location.pathname, { replace: true, state: null });
  }, [repeatDonation, startFromDonation, navigate, location.pathname]);

  // O formulário só aparece depois que o cadastro carrega: vindo do detalhe, a
  // rolagem espera por ele.
  const approvalStatus = organizationQuery.data?.approvalStatus;
  useEffect(() => {
    if (donationDraft) donationFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [donationDraft, approvalStatus]);

  // O React Router não rola até a âncora sozinho, e as seções só existem depois
  // que o cadastro carrega — "Ver minhas reservas" caía no topo da página.
  useEffect(() => {
    if (!location.hash || !organizationQuery.isSuccess) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [location.hash, organizationQuery.isSuccess]);

  if (!user) return null;

  const organization = organizationQuery.data;
  const isApproved = organization?.approvalStatus === 'APPROVED';
  const notice = organization ? approvalNotice(organization.approvalStatus, kind) : null;

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
            {isApproved && (
              <Suspense fallback={<p className="text-sm text-ink-muted">Carregando indicadores…</p>}>
                {user.role === 'DONOR' ? <DonorMetrics /> : <NgoMetrics />}
              </Suspense>
            )}

            {organizationQuery.isLoading && <p className="text-sm text-ink-muted">Carregando cadastro…</p>}

            {/* Antes uma falha aqui deixava o painel vazio, sem erro nem como
                tentar de novo. */}
            {organizationQuery.isError && (
              <QueryState
                isLoading={false}
                isError
                error={organizationQuery.error}
                onRetry={() => organizationQuery.refetch()}
              >
                {null}
              </QueryState>
            )}

            {organization && (
              <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-[22px] font-semibold text-leaf-800">
                      {organization.tradeName}
                    </h2>
                    <p className="mt-0.5 text-sm text-ink-muted">{organization.legalName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={APPROVAL_TONE[organization.approvalStatus]}>
                      {APPROVAL_LABEL[organization.approvalStatus]}
                    </Badge>
                    <ButtonLink to="/account" variant="secondary">
                      Editar dados
                    </ButtonLink>
                  </div>
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
                {notice && (
                  <p
                    role="status"
                    className="rounded-2xl bg-sun-50 px-4 py-3 text-sm leading-relaxed font-semibold text-sun-900"
                  >
                    {notice}
                  </p>
                )}
              </section>
            )}

            {organizationQuery.isSuccess && !organization && (
              <section className="rounded-3xl border border-line bg-surface p-6">
                <h2 className="font-display text-[22px] font-semibold text-leaf-800">
                  {kind === 'NGO' ? 'Cadastre sua ONG' : 'Cadastre seu estabelecimento'}
                </h2>
                <p className="mt-1 mb-6 text-sm text-ink-muted">
                  Leva menos de um minuto. Assim que salvar, o resto do sistema é liberado — mapa, sua conta e{' '}
                  {kind === 'NGO' ? 'as doações para reservar' : 'a publicação de doações'}.
                </p>
                <OrganizationForm
                  kind={kind}
                  onCreated={(created) => {
                    queryClient.invalidateQueries({ queryKey: ['my-organization', kind] });
                    showToast(
                      created.approvalStatus === 'APPROVED'
                        ? `Cadastro concluído! Já dá pra ${kind === 'NGO' ? 'reservar' : 'publicar'} doações.`
                        : 'Cadastro enviado! Avisamos assim que for aprovado.',
                      'success',
                    );
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </section>
            )}

            {user.role === 'DONOR' && isApproved && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-display text-[22px] font-semibold text-leaf-800">Minhas doações</h2>
                  <Button
                    variant={showDonationForm ? 'secondary' : 'primary'}
                    onClick={() => (showDonationForm ? closeDonationForm() : setShowDonationForm(true))}
                    aria-expanded={showDonationForm}
                  >
                    {showDonationForm ? 'Fechar' : 'Nova doação'}
                  </Button>
                </div>

                {showDonationForm && (
                  <div ref={donationFormRef} className="scroll-mt-24 rounded-3xl border border-line bg-surface p-6">
                    <DonationForm
                      key={donationDraft?.key ?? 'new'}
                      draft={donationDraft?.draft}
                      onCancel={closeDonationForm}
                      onCreated={() => {
                        closeDonationForm();
                        queryClient.invalidateQueries({ queryKey: ['donations'] });
                        showToast('Doação publicada! As ONGs por perto já foram avisadas.', 'success');
                      }}
                    />
                  </div>
                )}

                <DonationsList mode="own" onRepeat={startFromDonation} />
              </section>
            )}

            {/* Reservas antes das recorrências: é onde há alguém esperando
                resposta, enquanto a recorrência é configuração de vez em quando. */}
            {user.role === 'DONOR' && organization && (
              <section id="reservas-recebidas" className="flex scroll-mt-24 flex-col gap-4">
                <h2 className="font-display text-[22px] font-semibold text-leaf-800">Reservas recebidas</h2>
                <ReservationsList />
              </section>
            )}

            {user.role === 'DONOR' && isApproved && <DonationTemplatesPanel />}

            {/* A ONG sem cadastro aprovado via a lista com botões "Reservar" que
                só falhavam no fim, depois de escolher os itens. */}
            {user.role === 'NGO' && isApproved && (
              <section className="flex flex-col gap-4">
                <h2 className="font-display text-[22px] font-semibold text-leaf-800">Doações disponíveis</h2>
                <DonationsList mode="available" />
              </section>
            )}

            {user.role === 'NGO' && organization && (
              <section id="minhas-reservas" className="flex scroll-mt-24 flex-col gap-4">
                <h2 className="font-display text-[22px] font-semibold text-leaf-800">Minhas reservas</h2>
                <ReservationsList />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
