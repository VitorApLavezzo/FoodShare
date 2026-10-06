import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onSocketEvent } from './socket';

interface DataChangedPayload {
  eventType: string;
  entityId: string;
}

/**
 * Mantém a tela viva sem F5.
 *
 * A API emite `data:changed` a cada mudança de domínio (doação publicada,
 * editada ou cancelada, reserva criada ou cancelada, retirada confirmada) e
 * aqui isso vira uma invalidação do cache inteiro do react-query. Invalidar
 * tudo, e não uma chave específica, é de propósito: o react-query só refaz as
 * queries que estão montadas, então o custo é o das telas abertas naquele
 * momento — e nenhuma tela nova precisa ser lembrada aqui depois.
 *
 * O polling de 60s continua existindo como rede de segurança para quando o
 * socket estiver fora do ar.
 */
export function useLiveUpdates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Uma ação costuma gerar vários eventos em sequência (cancelar uma doação
    // mexe na lista, nos itens e nas reservas). Sem a janela curta, cada um
    // viraria uma rodada de refetch.
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = onSocketEvent<DataChangedPayload>('data:changed', () => {
      clearTimeout(timer);
      timer = setTimeout(() => queryClient.invalidateQueries(), 250);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient]);
}
