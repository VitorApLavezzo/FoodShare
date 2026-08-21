import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  markNotificationRead,
  deleteNotification,
  clearNotifications,
  type AppNotification,
} from '../lib/notifications';
import { getSocket } from '../lib/socket';
import { useToast } from '../context/ToastContext';

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function NotificationsBell() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNew = (notification: { title: string; message: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      showToast(notification.title, 'info');
    };
    const handleRemoved = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification:new', handleNew);
    socket.on('notification:removed', handleRemoved);
    return () => {
      socket.off('notification:new', handleNew);
      socket.off('notification:removed', handleRemoved);
    };
  }, [queryClient, showToast]);

  const items = query.data?.items ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  const markRead = async (notification: AppNotification) => {
    if (notification.readAt) return;
    await markNotificationRead(notification.id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
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
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
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
              <button onClick={clearAll} className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
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
                <button onClick={() => markRead(notification)} className="flex-1 text-left text-sm">
                  <p className="font-medium text-neutral-900 dark:text-white">{notification.title}</p>
                  <p className="text-xs text-neutral-500">{notification.message}</p>
                  <p className="mt-0.5 text-[10px] text-neutral-400">{formatDate(notification.createdAt)}</p>
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
