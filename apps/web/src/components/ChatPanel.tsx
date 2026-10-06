import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMessages, sendMessageRest, type Message } from '../lib/chat';
import { emitSocketEvent, emitWithAck, onSocketEvent } from '../lib/socket';
import { formatTime } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { QueryState } from './ui/QueryState';

export function ChatPanel({ conversationId, onClose }: { conversationId: string; onClose?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => fetchMessages(conversationId),
  });

  /**
   * Enquanto o painel está aberto, o servidor sabe disso e deixa de gerar
   * notificação desta conversa para este usuário — a mensagem já chega na tela
   * pelo `message:new` abaixo, e um aviso no sino sobre algo que a pessoa está
   * lendo naquele instante é só ruído.
   *
   * O reenvio no `connect` cobre a reconexão: o socket é recriado quando o
   * token é renovado, e a entrada na room se perde junto com o anterior.
   */
  useEffect(() => {
    emitSocketEvent('conversation:open', { conversationId });
    const unsubscribeConnect = onSocketEvent('connect', () => {
      emitSocketEvent('conversation:open', { conversationId });
    });

    return () => {
      unsubscribeConnect();
      emitSocketEvent('conversation:close', { conversationId });
    };
  }, [conversationId]);

  useEffect(() => {
    return onSocketEvent<Message>('message:new', (message) => {
      if (message.conversationId !== conversationId) return;
      queryClient.setQueryData<Message[]>(['messages', conversationId], (prev) => {
        if (prev?.some((m) => m.id === message.id)) return prev;
        return prev ? [...prev, message] : [message];
      });
    });
  }, [conversationId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [query.data]);

  /**
   * O texto só sai do campo depois da confirmação. Antes ele era limpo na hora
   * e o envio ia sem ack: qualquer falha apagava a mensagem sem aviso nenhum.
   */
  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const ack = await emitWithAck<{ ok: boolean }>('message:send', { conversationId, body });

      if (!ack?.ok) {
        // Socket fora do ar ou envio recusado: tenta pelo REST antes de desistir.
        const message = await sendMessageRest(conversationId, body);
        queryClient.setQueryData<Message[]>(['messages', conversationId], (prev) =>
          prev?.some((m) => m.id === message.id) ? prev : prev ? [...prev, message] : [message],
        );
      }
      setDraft('');
    } catch (err) {
      setSendError('Não foi possível enviar. Sua mensagem continua no campo — tente de novo.');
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-96 flex-col rounded-xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Conversa sobre a retirada</span>
        {onClose && (
          <button onClick={onClose} className="text-sm text-neutral-500 hover:underline">
            Fechar
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={(query.data ?? []).length === 0}
          emptyMessage="Nenhuma mensagem ainda. Combine aqui os detalhes da retirada."
          onRetry={() => query.refetch()}
        >
          {(query.data ?? []).map((message) => {
            const mine = message.senderUserId === user?.id;
            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                    mine
                      ? 'bg-brand-600 text-white'
                      : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{message.body}</p>
                  <span className="mt-0.5 block text-[10px] opacity-70">{formatTime(message.createdAt)}</span>
                </div>
              </div>
            );
          })}
        </QueryState>
        <div ref={bottomRef} />
      </div>

      {sendError && (
        <p role="alert" className="px-3 pb-1 text-xs text-red-600 dark:text-red-400">
          {sendError}
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2 dark:border-neutral-800"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          placeholder="Escreva uma mensagem…"
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <Button type="submit" size="sm" loading={sending} disabled={!draft.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
