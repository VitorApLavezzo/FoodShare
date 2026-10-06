import { io, type Socket } from 'socket.io-client';
import { tokenStorage } from './token-storage';

type Handler = (...args: unknown[]) => void;

let socket: Socket | null = null;
let currentToken: string | null = null;

// Registro próprio de listeners: o socket é recriado quando o token muda (após
// um refresh), e antes disso os componentes ficavam escutando o socket antigo,
// já desconectado — as mensagens simplesmente paravam de chegar.
const listeners = new Map<string, Set<Handler>>();

function baseUrl() {
  return import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
}

export function ensureSocket(): Socket | null {
  const token = tokenStorage.getAccessToken();
  if (!token) {
    disconnectSocket();
    return null;
  }
  if (socket && currentToken === token) return socket;

  socket?.disconnect();
  socket = io(baseUrl(), { auth: { token }, transports: ['websocket'] });
  currentToken = token;

  for (const [event, handlers] of listeners) {
    for (const handler of handlers) socket.on(event, handler);
  }
  return socket;
}

/** Assina um evento e devolve a função de cancelamento (para o cleanup do efeito). */
export function onSocketEvent<T>(event: string, handler: (payload: T) => void): () => void {
  const typed = handler as Handler;
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(typed);
  ensureSocket()?.on(event, typed);

  return () => {
    listeners.get(event)?.delete(typed);
    socket?.off(event, typed);
  };
}

/** Envio sem resposta: se o socket não está de pé, não há o que fazer. */
export function emitSocketEvent(event: string, payload: unknown) {
  ensureSocket()?.emit(event, payload);
}

/**
 * Envia esperando confirmação do servidor. Sem o ack, uma mensagem recusada
 * (sem permissão, validação) desaparecia silenciosamente — o campo de texto já
 * tinha sido limpo e o usuário achava que enviou.
 */
export function emitWithAck<T>(event: string, payload: unknown, timeoutMs = 5000): Promise<T | null> {
  const active = ensureSocket();
  if (!active?.connected) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);

    active.emit(event, payload, (ack: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  currentToken = null;
}
