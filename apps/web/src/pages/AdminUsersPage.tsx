import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminUsers, updateUserStatus, type AdminUser } from '../lib/admin';
import { getApiErrorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { AppHeader } from '../components/layout/AppHeader';
import { QueryState } from '../components/ui/QueryState';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrador', DONOR: 'Doador', NGO: 'ONG' };

/** Moderação de usuários: até então não havia nenhuma forma de tirar do ar quem abusasse da plataforma. */
export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => fetchAdminUsers({ search: search || undefined }),
  });

  const mutation = useMutation({
    mutationFn: ({ id, isActive, reason }: { id: string; isActive: boolean; reason?: string }) =>
      updateUserStatus(id, isActive, reason),
    onSuccess: (user) => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      showToast(user.isActive ? 'Usuário desbloqueado.' : 'Usuário bloqueado.', 'info');
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível alterar o status.')),
  });

  const toggle = (user: AdminUser) => {
    if (user.isActive) {
      const reason = window.prompt(`Motivo do bloqueio de ${user.name} (aparece para a pessoa no login):`);
      if (reason === null) return;
      mutation.mutate({ id: user.id, isActive: false, reason: reason || undefined });
    } else {
      if (!window.confirm(`Desbloquear ${user.name}?`)) return;
      mutation.mutate({ id: user.id, isActive: true });
    }
  };

  const items = query.data?.items ?? [];

  return (
    <div>
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="font-display text-2xl font-medium text-neutral-900 dark:text-white">Usuários</h1>
        <p className="text-sm text-neutral-500">Bloqueie contas em caso de abuso; o acesso cai na hora.</p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          aria-label="Buscar usuário"
          className="mt-4 w-full max-w-sm rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-4">
          <QueryState
            isLoading={query.isLoading}
            isError={query.isError}
            error={query.error}
            isEmpty={items.length === 0}
            emptyMessage="Nenhum usuário encontrado."
            onRetry={() => query.refetch()}
          >
            <div className="flex flex-col gap-2">
              {items.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-900 dark:text-white">
                      {user.name}{' '}
                      <span className="text-xs font-normal text-neutral-500">({ROLE_LABEL[user.role] ?? user.role})</span>
                    </p>
                    <p className="text-sm text-neutral-500">{user.email}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Desde {formatDateTime(user.createdAt)}
                      {user.organizationLinks[0] && <> · {user.organizationLinks[0].organization.tradeName}</>}
                      {!user.emailVerifiedAt && <> · e-mail não confirmado</>}
                    </p>
                    {!user.isActive && user.deactivatedReason && (
                      <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                        Bloqueado: {user.deactivatedReason}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={user.isActive ? 'danger' : 'secondary'}
                    loading={mutation.isPending}
                    onClick={() => toggle(user)}
                  >
                    {user.isActive ? 'Bloquear' : 'Desbloquear'}
                  </Button>
                </div>
              ))}
            </div>
          </QueryState>
        </div>
      </div>
    </div>
  );
}
