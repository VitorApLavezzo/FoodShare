import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '../../lib/audit';

const EVENT_LABEL: Record<string, string> = {
  DONATION_CREATED: 'Doação criada',
  DONATION_UPDATED: 'Doação editada',
  DONATION_CANCELLED: 'Doação cancelada',
  DONATION_EXPIRED: 'Doação expirada',
  DONATION_RESERVED: 'Doação reservada',
  RESERVATION_CANCELLED: 'Reserva cancelada',
  PICKUP_CONFIRMED: 'Retirada confirmada',
  DONOR_REGISTERED: 'Doador cadastrado',
  NGO_REGISTERED: 'ONG cadastrada',
  ORGANIZATION_APPROVAL_CHANGED: 'Aprovação alterada',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

export function AuditLogList() {
  const query = useQuery({ queryKey: ['audit-logs'], queryFn: fetchAuditLogs });

  if (query.isLoading) return <p className="text-sm text-neutral-500">Carregando histórico…</p>;
  const items = query.data?.items ?? [];

  return (
    <div className="rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
          Histórico de eventos ({query.data?.total ?? 0})
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-neutral-500">Nenhum evento registrado ainda.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {items.map((log) => (
            <li key={log.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-medium text-neutral-900 dark:text-white">
                  {EVENT_LABEL[log.eventType] ?? log.eventType}
                </span>
                <span className="text-neutral-500"> · {log.entity} · nó {log.nodeId}</span>
              </div>
              <span className="text-xs text-neutral-500">{formatDate(log.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
