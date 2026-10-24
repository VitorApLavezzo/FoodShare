import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDonationsReport,
  fetchImpactReport,
  downloadDonationsCsv,
  type ReportFilters,
} from '../lib/reports';
import {
  CATEGORY_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  type DonationCategory,
  type DonationItemStatus,
} from '../lib/donations';
import { getApiErrorMessage } from '../lib/api';
import { useDebouncedValue } from '../lib/use-debounced-value';
import { useToast } from '../context/ToastContext';
import { AppHeader } from '../components/layout/AppHeader';
import { Button } from '../components/ui/Button';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import { StatCard, FeatureStatCard } from '../components/dashboard/StatCard';
import { FILTER_CONTROL_CLASS } from '../components/ui/Field';
import { QueryState } from '../components/ui/QueryState';

const labelClass = 'mb-1 block text-xs font-semibold text-ink-muted';

const STATUS_TONE: Record<string, BadgeTone> = {
  AVAILABLE: 'leaf',
  FULLY_RESERVED: 'sun',
  CANCELLED: 'stone',
  EXPIRED: 'stone',
};

interface FilterForm {
  startDate: string;
  endDate: string;
  city: string;
  category: string;
  status: string;
}

const EMPTY_FORM: FilterForm = { startDate: '', endDate: '', city: '', category: '', status: '' };

/**
 * O `<input type="date">` devolve só o dia ("2026-10-24"). `new Date()` disso é
 * meia-noite em UTC — no Brasil, 21h do dia anterior —, então escolher "Fim =
 * 24/10" deixava de fora tudo o que foi doado no próprio dia 24. O intervalo
 * agora vai do começo do dia inicial ao último instante do dia final, no fuso
 * de quem está usando.
 */
function toReportFilters(form: FilterForm, city: string): ReportFilters {
  return {
    startDate: form.startDate ? new Date(`${form.startDate}T00:00:00`).toISOString() : undefined,
    endDate: form.endDate ? new Date(`${form.endDate}T23:59:59.999`).toISOString() : undefined,
    city: city || undefined,
    category: form.category || undefined,
    status: form.status || undefined,
  };
}

export function ReportsPage() {
  const { showToast } = useToast();
  const [form, setForm] = useState<FilterForm>(EMPTY_FORM);
  const [downloading, setDownloading] = useState(false);
  // A cidade espera a digitação parar: antes cada letra disparava dois relatórios.
  const debouncedCity = useDebouncedValue(form.city.trim());
  const filters = toReportFilters(form, debouncedCity);
  const hasFilters = Object.values(form).some(Boolean);

  const donationsQuery = useQuery({
    queryKey: ['reports', 'donations', filters],
    queryFn: () => fetchDonationsReport(filters),
  });
  const impactQuery = useQuery({
    queryKey: ['reports', 'impact', filters],
    queryFn: () => fetchImpactReport(filters),
  });

  const update = (patch: Partial<FilterForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleExport = async () => {
    setDownloading(true);
    try {
      await downloadDonationsCsv(filters);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Não foi possível exportar o CSV agora.'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  const impact = impactQuery.data;
  const rows = donationsQuery.data ?? [];
  // A barra é relativa ao maior município, não ao total: a comparação que
  // interessa é entre regiões, não a fatia de cada uma no todo.
  const maxRegion = Math.max(...(impact?.impactByRegion ?? []).map((r) => r.donations), 1);

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-6 pt-8 pb-20">
        <div>
          <h1 className="font-display text-[2.125rem] leading-tight font-semibold text-leaf-800">
            Relatórios
          </h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            Doações, distribuição e impacto por período/região.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3 rounded-[20px] border border-line bg-surface p-4">
          <div>
            <label className={labelClass} htmlFor="report-start">
              Início
            </label>
            <input
              id="report-start"
              type="date"
              value={form.startDate}
              max={form.endDate || undefined}
              className={FILTER_CONTROL_CLASS}
              onChange={(e) => update({ startDate: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="report-end">
              Fim
            </label>
            <input
              id="report-end"
              type="date"
              value={form.endDate}
              min={form.startDate || undefined}
              className={FILTER_CONTROL_CLASS}
              onChange={(e) => update({ endDate: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="report-city">
              Cidade
            </label>
            <input
              id="report-city"
              value={form.city}
              className={`${FILTER_CONTROL_CLASS} w-36`}
              onChange={(e) => update({ city: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="report-category">
              Categoria
            </label>
            <select
              id="report-category"
              value={form.category}
              className={FILTER_CONTROL_CLASS}
              onChange={(e) => update({ category: e.target.value })}
            >
              <option value="">Todas</option>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="report-status">
              Status
            </label>
            <select
              id="report-status"
              value={form.status}
              className={FILTER_CONTROL_CLASS}
              onChange={(e) => update({ status: e.target.value })}
            >
              <option value="">Todos</option>
              {Object.entries(DONATION_ITEM_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setForm(EMPTY_FORM)}
              className="self-center rounded-sm px-1 text-sm font-semibold text-ink-muted transition hover:text-leaf-800 hover:underline"
            >
              Limpar filtros
            </button>
          )}
          <Button
            className="ml-auto"
            loading={downloading}
            disabled={rows.length === 0}
            onClick={handleExport}
          >
            Exportar CSV
          </Button>
        </div>

        {impact && (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total de doações" value={impact.totalDonations} />
            <StatCard label="Concluídas" value={impact.totalCompleted} />
            <FeatureStatCard label="Quantidade distribuída" value={impact.totalQuantityDistributed} />
          </div>
        )}

        {impact && impact.impactByRegion.length > 0 && (
          <div className="rounded-[22px] border border-line bg-surface px-6 py-5">
            <h2 className="font-display mb-2 text-xl font-semibold text-leaf-800">Impacto por região</h2>
            <ul>
              {impact.impactByRegion.map((r) => (
                <li
                  key={r.city}
                  className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-4 border-t border-sand py-2.5 text-sm"
                >
                  <span className="font-semibold text-ink">{r.city}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-sand">
                    <div
                      className="h-full rounded-full bg-leaf-600"
                      style={{ width: `${Math.round((r.donations / maxRegion) * 100)}%` }}
                    />
                  </div>
                  <span className="text-ink-muted">
                    {r.donations} doações · {r.quantity} distribuído
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <QueryState
          isLoading={donationsQuery.isLoading}
          isError={donationsQuery.isError}
          error={donationsQuery.error}
          isEmpty={rows.length === 0}
          emptyMessage={
            hasFilters
              ? 'Nada encontrado para esses filtros. Tente um período maior.'
              : 'Nenhuma doação registrada ainda.'
          }
          onRetry={() => donationsQuery.refetch()}
        >
          <div className="overflow-x-auto rounded-[22px] border border-line bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-sand-soft text-left">
                <tr>
                  {['Alimento', 'Categoria', 'Qtd.', 'Status', 'Doador', 'Cidade', 'ONG'].map((head) => (
                    <th
                      key={head}
                      className="px-4 py-3 text-xs font-bold tracking-[0.04em] text-ink-muted uppercase"
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.donationId} className="border-t border-sand">
                    <td className="px-4 py-3 font-semibold text-ink">{row.foodName}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {CATEGORY_LABEL[row.category as DonationCategory] ?? row.category}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {row.quantity} {row.unit}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[row.status] ?? 'stone'} className="px-2.5 py-0.5">
                        {DONATION_ITEM_STATUS_LABEL[row.status as DonationItemStatus] ?? row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{row.donorName}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {row.donorCity}/{row.donorState}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{row.ngoName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </div>
    </div>
  );
}
