import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  markNotificationRead,
  deleteNotification,
  clearNotifications,
  type AppNotification,
} from '../lib/notifications';
import { onSocketEvent } from '../lib/socket';
import { formatDateTime } from '../lib/format';
import { useToast } from '../context/ToastContext';

export function NotificationsBell() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Fecha com Esc ou clique fora — o menu só fechava clicando de novo no sino.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, [open]);

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const unsubscribeNew = onSocketEvent<{ title: string; message: string }>(
      'notification:new',
      (notification) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        showToast(notification.title, 'info');
      },
    );
    const unsubscribeRemoved = onSocketEvent('notification:removed', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      unsubscribeNew();
      unsubscribeRemoved();
    };
  }, [queryClient, showToast]);

  const items = query.data?.items ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  // Clicar na notificação leva ao que a originou — antes ela só marcava como
  // lida e o usuário tinha de caçar a doação na lista. Aviso de mensagem vai
  // para o painel com a conversa já aberta: o chat vive junto da reserva, e
  // mandar para o detalhe da doação deixaria o usuário numa tela sem chat.
  const openNotification = async (notification: AppNotification) => {
    if (!notification.readAt) {
      await markNotificationRead(notification.id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (notification.conversationId) {
      setOpen(false);
      navigate(`/dashboard?conversa=${notification.conversationId}`);
      return;
    }
    if (notification.donationListId) {
      setOpen(false);
      navigate(`/doacoes/${notification.donationListId}`);
    }
  };

  const removeOne = async (id: string) => {
    await deleteNotification(id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const clearAll = async () => {
    await clearNotifications();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        aria-label="Notificações"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-xs font-semibold uppercase text-neutral-500">Notificações</span>
            {items.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                Limpar todas
              </button>
            )}
          </div>

          {items.length === 0 && <p className="p-3 text-sm text-neutral-500">Sem notificações.</p>}

          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {items.map((notification) => (
              <div
                key={notification.id}
                className={`group flex items-start gap-2 rounded-lg p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  notification.readAt ? 'opacity-60' : ''
                }`}
              >
                <button onClick={() => openNotification(notification)} className="flex-1 text-left text-sm">
                  <p className="font-medium text-neutral-900 dark:text-white">{notification.title}</p>
                  <p className="text-xs text-neutral-500">{notification.message}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">
                    {formatDateTime(notification.createdAt)}
                  </p>
                </button>
                <button
                  onClick={() => removeOne(notification.id)}
                  aria-label="Remover notificação"
                  className="shrink-0 rounded p-1 text-neutral-400 opacity-0 hover:bg-neutral-200 hover:text-neutral-700 group-hover:opacity-100 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
