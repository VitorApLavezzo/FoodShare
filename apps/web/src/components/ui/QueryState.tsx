import type { ReactNode } from 'react';
import { getApiErrorMessage } from '../../lib/api';
import { Button } from './Button';

/**
 * Antes cada lista tratava só `isLoading` e caía no estado vazio quando a API
 * falhava — um erro 500 aparecia para o usuário como "nenhum resultado".
 */
export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyMessage,
  onRetry,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) {
    return <p className="text-sm text-neutral-500">Carregando…</p>;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
      >
        <span>{getApiErrorMessage(error, 'Não foi possível carregar estes dados.')}</span>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <p className="rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {emptyMessage ?? 'Nada por aqui ainda.'}
      </p>
    );
  }

  return <>{children}</>;
}
