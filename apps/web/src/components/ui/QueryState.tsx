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
    return <p className="text-sm text-ink-muted">Carregando…</p>;
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger"
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
      <p className="rounded-[22px] border border-dashed border-line-bold p-6 text-center text-sm text-ink-muted">
        {emptyMessage ?? 'Nada por aqui ainda.'}
      </p>
    );
  }

  return <>{children}</>;
}
