import { useQuery } from '@tanstack/react-query';
import { fetchDonorDashboard } from '../../lib/dashboard';
import { QueryState } from '../ui/QueryState';
import { StatCard } from './StatCard';
import { MonthlyBars } from './MonthlyBars';

export function DonorMetrics() {
  const query = useQuery({ queryKey: ['dashboard', 'donor'], queryFn: fetchDonorDashboard });

  if (query.isLoading) return <p className="text-sm text-ink-muted">Carregando métricas…</p>;
  if (query.isError) {
    return (
      <QueryState isLoading={false} isError error={query.error} onRetry={() => query.refetch()}>
        {null}
      </QueryState>
    );
  }
  if (!query.data) return null;
  const { totals, completedPickups, totalQuantityDonated, monthly } = query.data;

  // RESERVED, PICKED_UP e DISTRIBUTED não existem entre os status de item: o
  // cartão "Reservadas" saía vazio e "Retiradas" ficava sempre em 0.
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[22px] font-semibold text-leaf-800">Meu impacto</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Itens disponíveis" value={totals.AVAILABLE ?? 0} />
        <StatCard label="Itens reservados" value={totals.FULLY_RESERVED ?? 0} />
        <StatCard label="Retiradas" value={completedPickups ?? 0} hint="confirmadas com código" />
        <StatCard label="Itens expirados" value={totals.EXPIRED ?? 0} />
        <StatCard label="Quantidade doada" value={totalQuantityDonated} hint="soma das doações retiradas" />
      </div>
      <MonthlyBars label="Doações por mês" data={monthly} />
    </section>
  );
}
