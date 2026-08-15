import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchAdminDashboard } from '../../lib/dashboard';
import { StatCard } from './StatCard';
import { CATEGORY_LABEL, type DonationCategory } from '../../lib/donations';

export function AdminMetrics() {
  const query = useQuery({ queryKey: ['dashboard', 'admin'], queryFn: fetchAdminDashboard });

  if (query.isLoading) return <p className="text-sm text-neutral-500">Carregando métricas…</p>;
  if (!query.data) return null;
  const { totals, donationsByMonth, donationsByCity, donationsByCategory, topDonors, utilizationRatePercent } =
    query.data;

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Visão geral da plataforma</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Estabelecimentos" value={totals.donors} />
        <StatCard label="ONGs" value={totals.ngos} />
        <StatCard label="Doações disponíveis" value={totals.donationsAvailable} />
        <StatCard label="Doações concluídas" value={totals.donationsCompleted} />
        <StatCard label="Doações expiradas" value={totals.donationsExpired} />
        <StatCard label="Quantidade total doada" value={totals.totalQuantityDonated} />
        <StatCard
          label="Pessoas atendidas (estimativa)"
          value={totals.estimatedPeopleServed}
          hint="cálculo aproximado, não é um número real"
        />
        <StatCard label="Nós online" value={`${totals.nodesOnline}/${totals.nodesTotal}`} />
        <StatCard label="Taxa de aproveitamento" value={`${utilizationRatePercent}%`} hint="concluídas / encerradas" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="h-56 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-2 text-xs font-medium text-neutral-500">Doações por mês</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={donationsByMonth}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Doações" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-56 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-2 text-xs font-medium text-neutral-500">Doações por cidade</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={donationsByCity} layout="vertical">
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="city" width={80} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="Doações" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-2 text-xs font-medium text-neutral-500">Alimentos por categoria</p>
          <ul className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
            {donationsByCategory.map((c) => (
              <li key={c.category} className="flex justify-between">
                <span>{CATEGORY_LABEL[c.category as DonationCategory] ?? c.category}</span>
                <span className="font-medium">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="mb-2 text-xs font-medium text-neutral-500">Estabelecimentos mais ativos</p>
          <ul className="flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-300">
            {topDonors.map((d) => (
              <li key={d.name} className="flex justify-between">
                <span>{d.name}</span>
                <span className="font-medium">{d.count}</span>
              </li>
            ))}
            {topDonors.length === 0 && <li className="text-neutral-500">Sem dados ainda.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
