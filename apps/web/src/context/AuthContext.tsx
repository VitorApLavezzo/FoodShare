import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { tokenStorage } from '../lib/token-storage';
import { disconnectSocket } from '../lib/socket';

export type UserRole = 'ADMIN' | 'DONOR' | 'NGO';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  nodeId: string;
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
  register: (input: { email: string; password: string; name: string; role: 'DONOR' | 'NGO' }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    tokenStorage.setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; name: string; role: 'DONOR' | 'NGO' }) => {
      const { data } = await api.post<AuthResponse>('/auth/register', input);
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    const refreshToken = tokenStorage.getRefreshToken();
    tokenStorage.clear();
    // Sem isso o WebSocket do usuário anterior continuava vivo e autenticado
    // depois do logout, recebendo notificações e mensagens dele.
    disconnectSocket();
    setUser(null);
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de um AuthProvider.');
  return ctx;
}
