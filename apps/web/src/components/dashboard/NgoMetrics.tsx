import { useQuery } from '@tanstack/react-query';
import { fetchNgoDashboard } from '../../lib/dashboard';
import { QueryState } from '../ui/QueryState';
import { StatCard } from './StatCard';

export function NgoMetrics() {
  const query = useQuery({ queryKey: ['dashboard', 'ngo'], queryFn: fetchNgoDashboard });

  if (query.isLoading) return <p className="text-sm text-ink-muted">Carregando métricas…</p>;
  if (query.isError) {
    return (
      <QueryState isLoading={false} isError error={query.error} onRetry={() => query.refetch()}>
        {null}
      </QueryState>
    );
  }
  if (!query.data) return null;
  const { availableNearby, activeReservations, completedPickups, totalQuantityReceived } = query.data;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-[22px] font-semibold text-leaf-800">Meu impacto</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Doações disponíveis" value={availableNearby} />
        <StatCard label="Reservas ativas" value={activeReservations} />
        <StatCard label="Retiradas concluídas" value={completedPickups} />
        <StatCard label="Quantidade recebida" value={totalQuantityReceived} />
      </div>
    </section>
  );
}
