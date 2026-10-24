import { useQuery } from '@tanstack/react-query';
import { fetchAdminDashboard } from '../../lib/dashboard';
import { QueryState } from '../ui/QueryState';
import { StatCard, FeatureStatCard } from './StatCard';
import { MonthlyBars } from './MonthlyBars';
import { RankBars } from './RankBars';
import { CATEGORY_LABEL, type DonationCategory } from '../../lib/donations';

export function AdminMetrics() {
  const query = useQuery({ queryKey: ['dashboard', 'admin'], queryFn: fetchAdminDashboard });

  if (query.isLoading) return <p className="text-sm text-ink-muted">Carregando métricas…</p>;
  if (query.isError) {
    return (
      <QueryState isLoading={false} isError error={query.error} onRetry={() => query.refetch()}>
        {null}
      </QueryState>
    );
  }
  if (!query.data) return null;
  const {
    totals,
    donationsByMonth,
    donationsByCity,
    donationsByCategory,
    topDonors,
    utilizationRatePercent,
  } = query.data;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[22px] font-semibold text-leaf-800">Visão geral da plataforma</h2>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Estabelecimentos" value={totals.donors} />
        <StatCard label="ONGs" value={totals.ngos} />
        <StatCard label="Doações disponíveis" value={totals.donationsAvailable} />
        <StatCard label="Doações concluídas" value={totals.donationsCompleted} />
        <StatCard label="Doações expiradas" value={totals.donationsExpired} />
        <StatCard label="Nós online" value={`${totals.nodesOnline}/${totals.nodesTotal}`} />
        <StatCard
          label="Taxa de aproveitamento"
          value={`${utilizationRatePercent}%`}
          hint="concluídas / encerradas"
        />
        <FeatureStatCard label="Quantidade total doada" value={totals.totalQuantityDonated} />
      </div>

      <MonthlyBars label="Doações por mês" data={donationsByMonth} />

      <div className="grid gap-4 lg:grid-cols-2">
        <RankBars
          label="Doações por cidade"
          data={donationsByCity.map((c) => ({ name: c.city, count: c.count }))}
        />
        <RankBars
          label="Alimentos por categoria"
          data={donationsByCategory.map((c) => ({
            name: CATEGORY_LABEL[c.category as DonationCategory] ?? c.category,
            count: c.count,
          }))}
        />
      </div>

      <RankBars label="Estabelecimentos mais ativos" data={topDonors} />
    </section>
  );
}
