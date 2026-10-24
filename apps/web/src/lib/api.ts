import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { tokenStorage } from './token-storage';
import { ensureSocket } from './socket';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
});

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
  correlationId?: string;
}

export function getApiErrorMessage(error: unknown, fallback = 'Algo deu errado.'): string {
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.error?.message ?? fallback;
}

api.interceptors.request.use((config) => {
  const token = tokenStorage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

// Rotas públicas de autenticação: um 401 delas é a resposta em si (senha
// errada, conta bloqueada), não sessão vencida. Tentar renovar o token ali
// falhava e mandava o navegador recarregar /login — a mensagem "E-mail ou senha
// inválidos" nunca chegava a aparecer.
const NO_REFRESH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
];

// 401 de regra de negócio, que renovar o token não resolve.
const NO_REFRESH_CODES = ['INVALID_CREDENTIALS', 'ACCOUNT_BLOCKED', 'INVALID_CURRENT_PASSWORD'];

const sessionExpiredListeners = new Set<() => void>();

/**
 * Avisa quando a sessão não pôde ser renovada. Antes o interceptor fazia
 * `window.location.href = '/login'`: recarregava a aplicação, perdia a página
 * em que a pessoa estava e expulsava até quem só abriu a landing page com um
 * token antigo guardado. Agora quem decide o que fazer é o AuthContext.
 */
export function onSessionExpired(listener: () => void) {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new Error('Sem refresh token disponível.');

  const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken });
  const { accessToken, refreshToken: newRefreshToken } = response.data;
  tokenStorage.setTokens(accessToken, newRefreshToken);
  // O socket foi aberto com o token antigo: reconecta com o novo, senão o
  // tempo real morre silenciosamente a cada renovação de sessão.
  ensureSocket();
  return accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    const errorCode = (error.response?.data as ApiErrorBody | undefined)?.error?.code;
    const canRefresh =
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !NO_REFRESH_PATHS.some((path) => originalRequest.url?.startsWith(path)) &&
      !NO_REFRESH_CODES.includes(errorCode ?? '') &&
      !!tokenStorage.getRefreshToken();

    if (canRefresh) {
      originalRequest._retry = true;
      try {
        refreshPromise ??= refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
        const newAccessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        tokenStorage.clear();
        sessionExpiredListeners.forEach((listener) => listener());
      }
    }

    return Promise.reject(error);
  },
);
