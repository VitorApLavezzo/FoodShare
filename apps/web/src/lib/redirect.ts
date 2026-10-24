import type { Location } from 'react-router-dom';

/**
 * Para onde mandar depois do login. Só aceita caminho interno: um `from`
 * vindo de fora ("//site-malicioso") viraria um redirecionamento aberto.
 */
export function getPostLoginPath(state: unknown): string {
  const from = (state as { from?: Partial<Location> } | null)?.from;
  const path = from?.pathname;
  if (!path || !path.startsWith('/') || path.startsWith('//') || path === '/login') return '/dashboard';
  return `${path}${from.search ?? ''}${from.hash ?? ''}`;
}
