import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '../../lib/audit';
import { QueryState } from '../ui/QueryState';

// As chaves seguem os `eventType` gravados pela API. Antes eram nomes de um
// rascunho (DONATION_CREATED, DONATION_UPDATED…) e quase todo evento aparecia
// como código cru no histórico.
const EVENT_LABEL: Record<string, string> = {
  DONATION_LIST_CREATED: 'Doação publicada',
  DONATION_LIST_CREATED_FROM_TEMPLATE: 'Doação recorrente publicada',
  DONATION_LIST_UPDATED: 'Doação editada',
  DONATION_LIST_CANCELLED: 'Doação cancelada',
  DONATION_LIST_EXPIRED: 'Doação expirada',
  DONATION_RESERVED: 'Doação reservada',
  RESERVATION_CANCELLED: 'Reserva cancelada',
  RESERVATION_EXPIRED: 'Reserva não retirada',
  PICKUP_CONFIRMED: 'Retirada confirmada',
  DONOR_REGISTERED: 'Doador cadastrado',
  NGO_REGISTERED: 'ONG cadastrada',
  ORGANIZATION_APPROVAL_CHANGED: 'Aprovação alterada',
  USER_BLOCKED: 'Usuário bloqueado',
  USER_UNBLOCKED: 'Usuário desbloqueado',
};

const ENTITY_LABEL: Record<string, string> = {
  DonationList: 'doação',
  Reservation: 'reserva',
  Pickup: 'retirada',
  Organization: 'organização',
  User: 'usuário',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
}

export function AuditLogList() {
  const query = useQuery({ queryKey: ['audit-logs'], queryFn: fetchAuditLogs });

  if (query.isLoading) return <p className="text-sm text-ink-muted">Carregando histórico…</p>;
  if (query.isError) {
    return (
      <QueryState isLoading={false} isError error={query.error} onRetry={() => query.refetch()}>
        {null}
      </QueryState>
    );
  }
  const items = query.data?.items ?? [];

  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
      <div className="border-b border-line bg-sand-soft px-4 py-3">
        <h2 className="font-display text-xl font-semibold text-leaf-800">
          Histórico de eventos ({query.data?.total ?? 0})
        </h2>
      </div>
      {items.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted">Nenhum evento registrado ainda.</p>
      ) : (
        <ul className="divide-y divide-sand">
          {items.map((log) => (
            <li key={log.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div>
                <span className="font-semibold text-ink">{EVENT_LABEL[log.eventType] ?? log.eventType}</span>
                <span className="text-ink-muted">
                  {' '}
                  · {ENTITY_LABEL[log.entity] ?? log.entity} · nó {log.nodeId}
                </span>
              </div>
              <span className="text-xs text-ink-muted">{formatDate(log.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
