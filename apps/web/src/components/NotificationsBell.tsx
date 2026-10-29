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
      // Falhar ao marcar como lida não pode impedir de abrir o que a originou.
      await markNotificationRead(notification.id).catch(() => undefined);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
    if (notification.conversationId) {
      setOpen(false);
      navigate(`/dashboard?conversa=${notification.conversationId}`);
      return;
    }
    // Reserva recebida: o que o doador precisa ver é quem reservou e o quê —
    // e isso mora no painel, não no detalhe da doação.
    if (notification.type === 'DONATION_RESERVED') {
      setOpen(false);
      navigate('/dashboard#reservas-recebidas');
      return;
    }
    if (notification.donationListId) {
      setOpen(false);
      navigate(`/doacoes/${notification.donationListId}`);
    }
  };

  const removeOne = async (id: string) => {
    try {
      await deleteNotification(id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      showToast('Não foi possível remover a notificação.', 'error');
    }
  };

  const clearAll = async () => {
    try {
      await clearNotifications();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      showToast('Não foi possível limpar as notificações.', 'error');
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-leaf-800 transition hover:bg-sand"
        aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun-500 px-1 text-[10px] font-bold text-leaf-800">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        // No celular o painel de 320px ancorado no sino vazava pela esquerda da
        // tela; ali ele ocupa a largura toda, abaixo do cabeçalho.
        <div className="fixed inset-x-4 top-[76px] z-40 rounded-[22px] border border-line bg-surface p-2 shadow-[0_12px_32px_rgba(22,82,46,0.12)] sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="px-1 text-xs font-bold tracking-[0.04em] text-ink-muted uppercase">
              Notificações
            </span>
            {items.length > 0 && (
              <button onClick={clearAll} className="text-xs font-bold text-leaf-600 hover:underline">
                Limpar todas
              </button>
            )}
          </div>

          {items.length === 0 && (
            <p className="p-3 text-sm text-ink-muted">Nada por aqui. Avisamos quando algo chegar.</p>
          )}

          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {items.map((notification) => (
              <div
                key={notification.id}
                className={`group flex items-start gap-2 rounded-2xl p-2.5 transition hover:bg-sand ${
                  notification.readAt ? 'opacity-60' : ''
                }`}
              >
                <button onClick={() => openNotification(notification)} className="flex-1 text-left text-sm">
                  <p className="font-semibold text-ink">{notification.title}</p>
                  <p className="text-xs text-ink-muted">{notification.message}</p>
                  <p className="mt-0.5 text-[10px] text-ink-dim">{formatDateTime(notification.createdAt)}</p>
                </button>
                <button
                  onClick={() => removeOne(notification.id)}
                  aria-label="Remover notificação"
                  className="shrink-0 rounded-full p-1 text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-line-strong hover:text-ink focus-visible:opacity-100"
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
