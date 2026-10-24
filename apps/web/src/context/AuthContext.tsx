import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onSessionExpired } from '../lib/api';
import { tokenStorage } from '../lib/token-storage';
import { disconnectSocket } from '../lib/socket';
import { useToast } from './ToastContext';

export type UserRole = 'ADMIN' | 'DONOR' | 'NGO';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  nodeId: string;
  emailVerifiedAt?: string | null;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    role: 'DONOR' | 'NGO';
  }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  // Lido dentro do aviso de sessão expirada, que é registrado uma vez só.
  const userRef = useRef(user);
  userRef.current = user;

  const loadCurrentUser = useCallback(async () => {
    if (!tokenStorage.getAccessToken()) {
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await api.get<AuthUser>('/users/me');
      setUser(data);
    } catch {
      tokenStorage.clear();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  // Sessão que não renovou: volta ao estado deslogado sem recarregar a página.
  // As rotas protegidas mandam para o login lembrando de onde a pessoa veio.
  useEffect(
    () =>
      onSessionExpired(() => {
        disconnectSocket();
        if (userRef.current) showToast('Sua sessão expirou. Entre de novo para continuar.', 'info');
        setUser(null);
      }),
    [showToast],
  );

  const startSession = useCallback(
    (data: AuthResponse) => {
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      // Cache de outra sessão (ou de antes do login) não pode aparecer na tela
      // de quem acabou de entrar.
      queryClient.clear();
      setUser(data.user);
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
      startSession(data);
    },
    [startSession],
  );

  const register = useCallback(
    async (input: { email: string; password: string; name: string; role: 'DONOR' | 'NGO' }) => {
      const { data } = await api.post<AuthResponse>('/auth/register', input);
      startSession(data);
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clear();
    // Sem isso o WebSocket do usuário anterior continuava vivo e autenticado
    // depois do logout, recebendo notificações e mensagens dele.
    disconnectSocket();
    setUser(null);
    // Idem para o cache: quem entrasse em seguida no mesmo navegador via, por
    // um instante, as doações e reservas da conta anterior.
    queryClient.clear();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, register, logout, setUser, reloadUser: loadCurrentUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider.');
  return ctx;
}
