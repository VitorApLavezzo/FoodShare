import { useQuery } from '@tanstack/react-query';
import { fetchNodes } from '../../lib/nodes';
import { fetchSyncStatus, fetchSyncEvents } from '../../lib/sync';
import { StatCard } from './StatCard';

const STATUS_BADGE: Record<string, string> = {
  ONLINE: 'bg-leaf-100 text-leaf-800',
  OFFLINE: 'bg-stone-100 text-ink-soft',
  DEGRADED: 'bg-sun-100 text-sun-800',
};

const EVENT_STATUS_BADGE: Record<string, string> = {
  SYNCED: 'bg-leaf-100 text-leaf-800',
  PENDING: 'bg-sun-100 text-sun-800',
  FAILED: 'bg-danger-50 text-danger',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

export function NodesSyncPanel() {
  const nodesQuery = useQuery({ queryKey: ['nodes'], queryFn: fetchNodes, refetchInterval: 15_000 });
  const statusQuery = useQuery({
    queryKey: ['sync-status'],
    queryFn: fetchSyncStatus,
    refetchInterval: 10_000,
  });
  const eventsQuery = useQuery({
    queryKey: ['sync-events'],
    queryFn: fetchSyncEvents,
    refetchInterval: 10_000,
  });

  // "Nó" identifica qual servidor processou a requisição, não a localização
  // geográfica da organização/doação — com um único servidor rodando, essa
  // seção não agrega informação útil e só confunde. Só aparece ao demonstrar
  // múltiplos nós de verdade (ver README, seção "múltiplos nós regionais").
  if (nodesQuery.isSuccess && (nodesQuery.data?.length ?? 0) <= 1) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="font-display text-[22px] font-semibold text-leaf-800">Nós & Sincronização</h2>
      <p className="mt-1 text-sm text-ink-muted">
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

      <div className="mt-4 overflow-hidden rounded-[22px] border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-sand-soft text-left text-xs font-bold tracking-[0.04em] text-ink-muted uppercase">
            <tr>
              <th className="px-4 py-2">Nó</th>
              <th className="px-4 py-2">Cidade</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Último heartbeat</th>
              <th className="px-4 py-2">Eventos pendentes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand">
            {nodesQuery.data?.map((node) => (
              <tr key={node.id}>
                <td className="px-4 py-2.5 font-semibold text-ink">{node.code}</td>
                <td className="px-4 py-2.5 text-ink-soft">
                  {node.city}/{node.state}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[node.status]}`}
                  >
                    {node.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{formatDate(node.lastHeartbeat)}</td>
                <td className="px-4 py-2.5 text-ink-soft">{node.pendingEvents}</td>
              </tr>
            ))}
            {nodesQuery.data?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">
                  Nenhum nó registrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 overflow-hidden rounded-[22px] border border-line bg-surface">
        <div className="border-b border-line bg-sand-soft px-4 py-2.5 text-xs font-bold tracking-[0.04em] text-ink-muted uppercase">
          Eventos de sincronização recentes
        </div>
        <ul className="divide-y divide-sand">
          {eventsQuery.data?.slice(0, 15).map((event) => (
            <li key={event.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-semibold text-ink">{event.eventType}</span>
                <span className="text-ink-muted">
                  {' '}
                  · origem {event.originNode} · seq {event.sequence}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${EVENT_STATUS_BADGE[event.status]}`}
                >
                  {event.status}
                </span>
                <span className="text-xs text-ink-muted">{formatDate(event.createdAt)}</span>
              </div>
            </li>
          ))}
          {eventsQuery.data?.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-ink-muted">Nenhum evento ainda.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
