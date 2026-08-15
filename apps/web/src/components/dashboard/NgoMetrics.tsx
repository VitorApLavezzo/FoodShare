import { useQuery } from '@tanstack/react-query';
import { fetchNgoDashboard } from '../../lib/dashboard';
import { StatCard } from './StatCard';

export function NgoMetrics() {
  const query = useQuery({ queryKey: ['dashboard', 'ngo'], queryFn: fetchNgoDashboard });

  if (query.isLoading) return <p className="text-sm text-neutral-500">Carregando métricas…</p>;
  if (!query.data) return null;
  const { availableNearby, activeReservations, completedPickups, totalQuantityReceived, estimatedPeopleServed } =
    query.data;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Meu impacto</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Doações disponíveis" value={availableNearby} />
        <StatCard label="Reservas ativas" value={activeReservations} />
        <StatCard label="Retiradas concluídas" value={completedPickups} />
        <StatCard label="Quantidade recebida" value={totalQuantityReceived} />
        <StatCard
          label="Pessoas atendidas (estimativa)"
          value={estimatedPeopleServed}
          hint="cálculo aproximado, não é um número real"
        />
      </div>
    </div>
  );
}
