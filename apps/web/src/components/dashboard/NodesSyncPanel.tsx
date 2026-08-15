import { useQuery } from '@tanstack/react-query';
import { fetchNodes } from '../../lib/nodes';
import { fetchSyncStatus, fetchSyncEvents } from '../../lib/sync';
import { StatCard } from './StatCard';

const STATUS_BADGE: Record<string, string> = {
  ONLINE: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-400',
  OFFLINE: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
  DEGRADED: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
};

const EVENT_STATUS_BADGE: Record<string, string> = {
  SYNCED: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-400',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

export function NodesSyncPanel() {
  const nodesQuery = useQuery({ queryKey: ['nodes'], queryFn: fetchNodes, refetchInterval: 15_000 });
  const statusQuery = useQuery({ queryKey: ['sync-status'], queryFn: fetchSyncStatus, refetchInterval: 10_000 });
  const eventsQuery = useQuery({ queryKey: ['sync-events'], queryFn: fetchSyncEvents, refetchInterval: 10_000 });

  // "Nó" identifica qual servidor processou a requisição, não a localização
  // geográfica da organização/doação — com um único servidor rodando, essa
  // seção não agrega informação útil e só confunde. Só aparece ao demonstrar
  // múltiplos nós de verdade (ver README, seção "múltiplos nós regionais").
  if (nodesQuery.isSuccess && (nodesQuery.data?.length ?? 0) <= 1) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Nós & Sincronização</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Múltiplos nós detectados — cada um é uma instância independente do backend, identificada por onde a
        requisição foi processada (não pela cidade da organização).
      </p>

      {statusQuery.data && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatCard label="Eventos pendentes" value={statusQuery.data.pending} />
          <StatCard label="Eventos sincronizados" value={statusQuery.data.synced} />
          <StatCard label="Eventos com erro" value={statusQuery.data.failed} />
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-2">Nó</th>
              <th className="px-4 py-2">Cidade</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Último heartbeat</th>
              <th className="px-4 py-2">Eventos pendentes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {nodesQuery.data?.map((node) => (
              <tr key={node.id}>
                <td className="px-4 py-2 font-medium text-neutral-900 dark:text-white">{node.code}</td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                  {node.city}/{node.state}
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[node.status]}`}>
                    {node.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                  {formatDate(node.lastHeartbeat)}
                </td>
                <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">{node.pendingEvents}</td>
              </tr>
            ))}
            {nodesQuery.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-neutral-500">
                  Nenhum nó registrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <div className="border-b border-neutral-200 px-4 py-2 text-xs font-medium uppercase text-neutral-500 dark:border-neutral-800">
          Eventos de sincronização recentes
        </div>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {eventsQuery.data?.slice(0, 15).map((event) => (
            <li key={event.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-neutral-900 dark:text-white">{event.eventType}</span>
                <span className="text-neutral-500"> · origem {event.originNode} · seq {event.sequence}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_STATUS_BADGE[event.status]}`}>
                  {event.status}
                </span>
                <span className="text-xs text-neutral-500">{formatDate(event.createdAt)}</span>
              </div>
            </li>
          ))}
          {eventsQuery.data?.length === 0 && (
            <li className="px-4 py-4 text-center text-sm text-neutral-500">Nenhum evento ainda.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
