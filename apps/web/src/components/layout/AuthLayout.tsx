import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo, LogoMark } from './Logo';

const HIGHLIGHTS = [
  { icon: '🍞', text: 'Estabelecimentos publicam excedentes em segundos' },
  { icon: '🤝', text: 'ONGs reservam com prioridade e sem conflito' },
  { icon: '📍', text: 'Retirada rastreada, do prato até quem recebe' },
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-800 p-10 text-white lg:flex">
        <div className="bg-grain pointer-events-none absolute inset-0 opacity-40" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent-500/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-400/30 blur-3xl"
          aria-hidden
        />

        <Link to="/" className="relative z-10">
          <span className="inline-flex items-center gap-2">
            <LogoMark className="h-9 w-9" />
            <span className="font-display text-xl font-semibold tracking-tight">FoodShare</span>
          </span>
        </Link>

        <div className="relative z-10 max-w-md">
          <p className="font-display text-3xl font-medium leading-snug text-white">
            Comida boa não devia virar lixo enquanto alguém passa fome.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm text-brand-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg">
                  {h.icon}
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-brand-100/70">
          Plataforma distribuída · construída para múltiplas cidades e regiões
        </p>
      </div>

      <div className="flex flex-col justify-center bg-white px-6 py-12 dark:bg-neutral-950 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <h1 className="font-display text-3xl font-semibold text-neutral-900 dark:text-white">{title}</h1>
          <p className="mt-2 text-sm text-neutral-500">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-8 text-center text-sm text-neutral-500">{footer}</div>
        </div>
      </div>
    </div>
  );
}
