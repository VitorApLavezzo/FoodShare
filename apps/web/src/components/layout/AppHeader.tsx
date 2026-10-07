import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Logo } from './Logo';
import { NotificationsBell } from '../NotificationsBell';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  DONOR: 'Doador',
  NGO: 'ONG',
};

// A etiqueta de papel do design é a da ONG (verde claro sobre verde escuro).
// Doador herda o laranja — é a cor da doação em toda a interface, e doador é
// quem publica. Admin fica no tom da tinta, sem competir com os dois.
const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-ink text-canvas',
  DONOR: 'bg-sun-100 text-sun-800',
  NGO: 'bg-leaf-100 text-leaf-800',
};

function NavLink({ to, label }: { to: string; label: string }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
        active ? 'bg-leaf-800 text-canvas' : 'text-ink-soft hover:bg-sand hover:text-leaf-800'
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
    // z-1000 e não o z-30 de antes: os painéis do Leaflet sobem até z-400 e
    // passavam por cima do cabeçalho ao rolar o mapa.
    <header className="sticky top-0 z-[1000] border-b border-line bg-canvas/92 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center">
            <Logo className="h-7 w-auto" />
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
            className="hidden flex-col items-end gap-0.5 rounded-xl px-2.5 py-1 transition hover:bg-sand sm:flex"
          >
            <span className="text-sm leading-none font-semibold text-ink">{user.name.split(' ')[0]}</span>
            <span
              className={`rounded-full px-2 py-px text-[10px] font-bold tracking-[0.05em] uppercase ${ROLE_BADGE[user.role]}`}
            >
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </Link>
          <button
            onClick={() => logout()}
            className="rounded-full border-[1.5px] border-line-bold bg-surface px-4 py-1.5 text-sm font-semibold text-leaf-800 transition hover:border-leaf-800"
          >
            Sair
          </button>
        </div>
      </div>

      <nav className="flex items-center gap-1 border-t border-line px-6 py-2 sm:hidden">
        <NavLink to="/dashboard" label="Painel" />
        <NavLink to="/map" label="Mapa" />
        {user.role === 'ADMIN' && <NavLink to="/reports" label="Relatórios" />}
        <NavLink to="/account" label="Conta" />
      </nav>
    </header>
  );
}
