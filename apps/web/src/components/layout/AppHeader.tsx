import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Logo } from './Logo';
import { Button } from '../ui/Button';
import { NotificationsBell } from '../NotificationsBell';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  DONOR: 'Doador',
  NGO: 'ONG',
};

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900',
  DONOR: 'bg-accent-100 text-accent-800 dark:bg-accent-950/40 dark:text-accent-300',
  NGO: 'bg-brand-100 text-brand-800 dark:bg-brand-950/40 dark:text-brand-300',
};

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
          : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
}

export function AppHeader() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/85 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link to="/dashboard">
            <Logo markClassName="h-7 w-7" />
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/dashboard" label="Painel" />
            <NavLink to="/map" label="Mapa" />
            {user.role === 'ADMIN' && <NavLink to="/reports" label="Relatórios" />}
            {user.role === 'ADMIN' && <NavLink to="/admin/usuarios" label="Usuários" />}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {(user.role === 'DONOR' || user.role === 'NGO') && <NotificationsBell />}
          <Link
            to="/account"
            className="hidden rounded-lg px-2 py-1 text-right transition hover:bg-neutral-100 sm:block dark:hover:bg-neutral-800"
          >
            <p className="text-sm font-medium leading-tight text-neutral-900 dark:text-white">
              {user.name.split(' ')[0]}
            </p>
            <span
              className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ROLE_BADGE[user.role]}`}
            >
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </Link>
          <Button variant="secondary" size="sm" onClick={() => logout()}>
            Sair
          </Button>
        </div>
      </div>
      <nav className="flex items-center gap-1 border-t border-neutral-200 px-6 py-2 sm:hidden dark:border-neutral-800">
        <NavLink to="/dashboard" label="Painel" />
        <NavLink to="/map" label="Mapa" />
        {user.role === 'ADMIN' && <NavLink to="/reports" label="Relatórios" />}
        <NavLink to="/account" label="Conta" />
      </nav>
    </header>
  );
}
