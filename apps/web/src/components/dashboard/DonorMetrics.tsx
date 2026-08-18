import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchDonorDashboard } from '../../lib/dashboard';
import { StatCard } from './StatCard';

export function DonorMetrics() {
  const query = useQuery({ queryKey: ['dashboard', 'donor'], queryFn: fetchDonorDashboard });

  if (query.isLoading) return <p className="text-sm text-neutral-500">Carregando métricas…</p>;
  if (!query.data) return null;
  const { totals, totalQuantityDonated, monthly } = query.data;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Meu impacto</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Disponíveis" value={totals.AVAILABLE} />
        <StatCard label="Reservadas" value={totals.RESERVED} />
        <StatCard label="Retiradas" value={(totals.PICKED_UP ?? 0) + (totals.DISTRIBUTED ?? 0)} />
        <StatCard label="Expiradas" value={totals.EXPIRED} />
        <StatCard label="Quantidade doada" value={totalQuantityDonated} hint="soma das doações retiradas" />
      </div>

      <div className="mt-4 h-56 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly}>
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="count" name="Doações" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
