import type { ReactNode } from 'react';

/**
 * Etiqueta de estado. Cada tom carrega um significado fixo em todo o sistema:
 * verde = disponível agora, laranja = comprometido com alguém, azul = ciclo
 * encerrado sem pendência, pedra = terminou sem acontecer, vermelho = bloqueio.
 */
export type BadgeTone = 'leaf' | 'sun' | 'dusk' | 'stone' | 'ink' | 'danger';

const TONE_CLASS: Record<BadgeTone, string> = {
  leaf: 'bg-leaf-100 text-leaf-800',
  sun: 'bg-sun-100 text-sun-800',
  dusk: 'bg-dusk-100 text-dusk-800',
  stone: 'bg-stone-100 text-ink-soft',
  ink: 'bg-leaf-800 text-canvas',
  danger: 'bg-danger-50 text-danger',
};

export function Badge({
  tone = 'leaf',
  className = '',
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Variante miúda do cabeçalho e da lista de usuários (papel da conta). */
export function RoleBadge({
  tone = 'leaf',
  className = '',
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2 py-px text-[10px] font-bold tracking-[0.05em] uppercase ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
