import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMessages, sendMessageRest, type Message } from '../lib/chat';
import { getSocket } from '../lib/socket';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ChatPanel({ conversationId, onClose }: { conversationId: string; onClose?: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => fetchMessages(conversationId),
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = (message: Message) => {
      if (message.conversationId !== conversationId) return;
      queryClient.setQueryData<Message[]>(['messages', conversationId], (prev) =>
        prev ? [...prev, message] : [message],
      );
    };

    socket.on('message:new', handleNewMessage);
    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [query.data]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft('');

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('message:send', { conversationId, body });
    } else {
      const message = await sendMessageRest(conversationId, body);
      queryClient.setQueryData<Message[]>(['messages', conversationId], (prev) =>
        prev ? [...prev, message] : [message],
      );
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
        {query.isLoading && <p className="text-sm text-neutral-500">Carregando mensagens…</p>}
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
                <p>{message.body}</p>
                <span className="mt-0.5 block text-[10px] opacity-70">{formatTime(message.createdAt)}</span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

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
          placeholder="Escreva uma mensagem…"
          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <Button type="submit" size="sm">
          Enviar
        </Button>
      </form>
    </div>
  );
}
