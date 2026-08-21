import { io, type Socket } from 'socket.io-client';
import { tokenStorage } from './token-storage';

let socket: Socket | null = null;

// Conexão única compartilhada por toda a app (notificações + chat), para não
// abrir um WebSocket por componente montado.
export function getSocket(): Socket | null {
  const token = tokenStorage.getAccessToken();
  if (!token) return null;

  if (socket && socket.auth && (socket.auth as { token?: string }).token === token) {
    return socket;
  }

  socket?.disconnect();
  const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
  socket = io(baseUrl, { auth: { token }, transports: ['websocket'] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
