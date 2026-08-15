import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDonationsReport,
  fetchImpactReport,
  downloadDonationsCsv,
  type ReportFilters,
} from '../lib/reports';
import { CATEGORY_LABEL, STATUS_LABEL, type DonationCategory, type DonationStatus } from '../lib/donations';
import { AppHeader } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';

const inputClass =
  'rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900';

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [downloading, setDownloading] = useState(false);

  const donationsQuery = useQuery({
    queryKey: ['reports', 'donations', filters],
    queryFn: () => fetchDonationsReport(filters),
  });
  const impactQuery = useQuery({
    queryKey: ['reports', 'impact', filters],
    queryFn: () => fetchImpactReport(filters),
  });

  const update = (patch: Partial<ReportFilters>) => setFilters((prev) => ({ ...prev, ...patch }));

  const handleExport = async () => {
    setDownloading(true);
    try {
      await downloadDonationsCsv(filters);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-medium text-neutral-900 dark:text-white">Relatórios</h1>
        <p className="text-sm text-neutral-500">Doações, distribuição e impacto por período/região.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Início</label>
          <input
            type="date"
            className={inputClass}
            onChange={(e) => update({ startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Fim</label>
          <input
            type="date"
            className={inputClass}
            onChange={(e) => update({ endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Cidade</label>
          <input className={inputClass} onChange={(e) => update({ city: e.target.value || undefined })} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Categoria</label>
          <select className={inputClass} onChange={(e) => update({ category: e.target.value || undefined })}>
            <option value="">Todas</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-neutral-500">Status</label>
          <select className={inputClass} onChange={(e) => update({ status: e.target.value || undefined })}>
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" className="ml-auto" loading={downloading} onClick={handleExport}>
          Exportar CSV
        </Button>
      </div>

      {impactQuery.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs uppercase text-neutral-500">Total de doações</p>
            <p className="text-xl font-semibold text-neutral-900 dark:text-white">{impactQuery.data.totalDonations}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs uppercase text-neutral-500">Concluídas</p>
            <p className="text-xl font-semibold text-neutral-900 dark:text-white">{impactQuery.data.totalCompleted}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs uppercase text-neutral-500">Quantidade distribuída</p>
            <p className="text-xl font-semibold text-neutral-900 dark:text-white">
              {impactQuery.data.totalQuantityDistributed}
            </p>
          </div>
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-xs uppercase text-neutral-500">Pessoas atendidas (estimativa)</p>
            <p className="text-xl font-semibold text-neutral-900 dark:text-white">
              {impactQuery.data.estimatedPeopleServed}
            </p>
          </div>
        </div>
      )}

      {impactQuery.data && impactQuery.data.impactByRegion.length > 0 && (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">Impacto por região</h2>
          <ul className="flex flex-col divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            {impactQuery.data.impactByRegion.map((r) => (
              <li key={r.city} className="flex justify-between py-1.5">
                <span>{r.city}</span>
                <span className="text-neutral-500">
                  {r.donations} doações · {r.quantity} distribuído
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-3 py-2">Alimento</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Qtd.</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Doador</th>
              <th className="px-3 py-2">Cidade</th>
              <th className="px-3 py-2">ONG</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {donationsQuery.data?.map((row) => (
              <tr key={row.donationId}>
                <td className="px-3 py-2">{row.foodName}</td>
                <td className="px-3 py-2">{CATEGORY_LABEL[row.category as DonationCategory] ?? row.category}</td>
                <td className="px-3 py-2">
                  {row.quantity} {row.unit}
                </td>
                <td className="px-3 py-2">{STATUS_LABEL[row.status as DonationStatus] ?? row.status}</td>
                <td className="px-3 py-2">{row.donorName}</td>
                <td className="px-3 py-2">
                  {row.donorCity}/{row.donorState}
                </td>
                <td className="px-3 py-2">{row.ngoName || '—'}</td>
              </tr>
            ))}
            {donationsQuery.data?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-neutral-500">
                  Nenhum resultado para os filtros selecionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
