import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';
import { useOrganizationGate } from '../lib/use-my-organization';

/**
 * `roles` restringe a rota por papel. Antes só se exigia login: um doador que
 * digitasse /reports caía numa tela cheia de erros 403 em vez de voltar ao
 * próprio painel.
 */
export function ProtectedRoute({ roles }: { roles?: UserRole[] }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-ink-muted">Carregando…</div>;
  }

  if (!user) {
    // Guarda o destino: quem abre o link de uma doação (vindo de um e-mail, por
    // exemplo) volta para ela depois de entrar, e não para o painel.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

/**
 * Bloqueia o resto do sistema até o doador/ONG concluir o cadastro da
 * organização. Esconder os links não basta: digitar /map ou abrir um link
 * antigo também precisa cair de volta no formulário.
 */
export function RequireOrganization() {
  const { isChecking, isComplete } = useOrganizationGate();

  if (isChecking) {
    return <div className="flex min-h-screen items-center justify-center text-ink-muted">Carregando…</div>;
  }

  if (!isComplete) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
