import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAllOrganizations, updateApproval, type Organization } from '../../lib/organizations';
import { useToast } from '../../context/ToastContext';
import { getApiErrorMessage } from '../../lib/api';
import { Button } from '../ui/Button';

const APPROVAL_LABEL: Record<Organization['approvalStatus'], string> = {
  PENDING: 'Aguardando aprovação',
  APPROVED: 'Aprovado',
  REJECTED: 'Reprovado',
  BLOCKED: 'Bloqueado',
};

const APPROVAL_BADGE: Record<Organization['approvalStatus'], string> = {
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  APPROVED: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400',
  BLOCKED: 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300',
};

function OrganizationRow({ kind, org }: { kind: 'DONOR' | 'NGO'; org: Organization }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: (status: 'APPROVED' | 'REJECTED' | 'BLOCKED') => updateApproval(kind, org.id, status),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ['all-organizations'] });
      showToast(
        status === 'APPROVED' ? 'Cadastro aprovado.' : status === 'REJECTED' ? 'Cadastro reprovado.' : 'Cadastro bloqueado.',
        status === 'APPROVED' ? 'success' : 'info',
      );
    },
    onError: (err) => showToast(getApiErrorMessage(err, 'Não foi possível atualizar a aprovação.'), 'error'),
  });

  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium text-neutral-900 dark:text-white">{org.tradeName}</p>
        <p className="text-xs text-neutral-500">
          {org.legalName} · {org.address.city}/{org.address.state} · {org.email}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${APPROVAL_BADGE[org.approvalStatus]}`}>
          {APPROVAL_LABEL[org.approvalStatus]}
        </span>
        {org.approvalStatus !== 'APPROVED' && (
          <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate('APPROVED')}>
            Aprovar
          </Button>
        )}
        {org.approvalStatus === 'PENDING' && (
          <Button
            size="sm"
            variant="secondary"
            loading={mutation.isPending}
            onClick={() => mutation.mutate('REJECTED')}
          >
            Reprovar
          </Button>
        )}
        {org.approvalStatus !== 'BLOCKED' && (
          <Button size="sm" variant="danger" loading={mutation.isPending} onClick={() => mutation.mutate('BLOCKED')}>
            Bloquear
          </Button>
        )}
      </div>
    </li>
  );
}

function OrganizationTypeList({ kind, title }: { kind: 'DONOR' | 'NGO'; title: string }) {
  const query = useQuery({
    queryKey: ['all-organizations', kind],
    queryFn: () => fetchAllOrganizations(kind),
  });

  const items = query.data ?? [];
  const pending = items.filter((o) => o.approvalStatus === 'PENDING');
  const others = items.filter((o) => o.approvalStatus !== 'PENDING');
  const ordered = [...pending, ...others];

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h3>
        {pending.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
            {pending.length} pendente{pending.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {query.isLoading ? (
        <p className="p-4 text-sm text-neutral-500">Carregando…</p>
      ) : ordered.length === 0 ? (
        <p className="p-4 text-sm text-neutral-500">Nenhum cadastro ainda.</p>
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {ordered.map((org) => (
            <OrganizationRow key={org.id} kind={kind} org={org} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function PendingApprovalsPanel() {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Aprovação de cadastros</h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <OrganizationTypeList kind="DONOR" title="Doadores" />
        <OrganizationTypeList kind="NGO" title="ONGs" />
      </div>
    </div>
  );
}
