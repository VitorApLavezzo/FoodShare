import { useQuery } from '@tanstack/react-query';
import { fetchDonorDashboard } from '../../lib/dashboard';
import { StatCard } from './StatCard';
import { MonthlyBars } from './MonthlyBars';

export function DonorMetrics() {
  const query = useQuery({ queryKey: ['dashboard', 'donor'], queryFn: fetchDonorDashboard });

  if (query.isLoading) return <p className="text-sm text-ink-muted">Carregando métricas…</p>;
  if (!query.data) return null;
  const { totals, totalQuantityDonated, monthly } = query.data;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[22px] font-semibold text-leaf-800">Meu impacto</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Disponíveis" value={totals.AVAILABLE} />
        <StatCard label="Reservadas" value={totals.RESERVED} />
        <StatCard label="Retiradas" value={(totals.PICKED_UP ?? 0) + (totals.DISTRIBUTED ?? 0)} />
        <StatCard label="Expiradas" value={totals.EXPIRED} />
        <StatCard label="Quantidade doada" value={totalQuantityDonated} hint="soma das doações retiradas" />
      </div>
      <MonthlyBars label="Doações por mês" data={monthly} />
    </section>
  );
}
