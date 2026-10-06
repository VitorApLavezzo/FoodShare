import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminUsers, updateUserStatus, type AdminUser } from '../lib/admin';
import { getApiErrorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { AppHeader } from '../components/layout/AppHeader';
import { QueryState } from '../components/ui/QueryState';
import { Button } from '../components/ui/Button';
import { RoleBadge, type BadgeTone } from '../components/ui/Badge';
import { useToast } from '../context/ToastContext';

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrador', DONOR: 'Doador', NGO: 'ONG' };

// Mesma legenda de cor do resto do app: laranja publica, verde recebe.
const ROLE_TONE: Record<string, BadgeTone> = { ADMIN: 'ink', DONOR: 'sun', NGO: 'leaf' };

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
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 pt-8 pb-20">
        <div>
          <h1 className="font-display text-[2.125rem] leading-tight font-semibold text-leaf-800">Usuários</h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            Bloqueie contas em caso de abuso; o acesso cai na hora.
          </p>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou e-mail…"
          aria-label="Buscar usuário"
          className="w-full max-w-sm rounded-full border-[1.5px] border-line-strong bg-surface px-4.5 py-2.5 text-sm text-ink transition placeholder:text-ink-faint focus:border-leaf-600 focus:ring-4 focus:ring-leaf-600/15 focus:outline-none"
        />

        {error && (
          <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <div>
          <QueryState
            isLoading={query.isLoading}
            isError={query.isError}
            error={query.error}
            isEmpty={items.length === 0}
            emptyMessage="Nenhum usuário encontrado."
            onRetry={() => query.refetch()}
          >
            <div className="flex flex-col gap-2.5">
              {items.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line bg-surface px-5 py-4"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="flex flex-wrap items-center gap-2 text-base font-bold text-ink">
                      {user.name}
                      <RoleBadge tone={ROLE_TONE[user.role] ?? 'stone'}>
                        {ROLE_LABEL[user.role] ?? user.role}
                      </RoleBadge>
                    </p>
                    <p className="text-sm text-ink-muted">{user.email}</p>
                    <p className="mt-0.5 text-xs text-ink-dim">
                      Desde {formatDateTime(user.createdAt)}
                      {user.organizationLinks[0] && (
                        <> · {user.organizationLinks[0].organization.tradeName}</>
                      )}
                      {!user.emailVerifiedAt && <> · e-mail não confirmado</>}
                    </p>
                    {!user.isActive && user.deactivatedReason && (
                      <p className="mt-1 text-xs font-semibold text-danger">
                        Bloqueado: {user.deactivatedReason}
                      </p>
                    )}
                  </div>
                  <Button
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
