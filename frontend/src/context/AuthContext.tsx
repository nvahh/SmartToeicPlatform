import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { AuthResponse, UserProfile } from '../types/api';

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; password: string; fullName: string; targetScore?: number }) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    const token = localStorage.getItem('smart_toeic_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get<UserProfile>('/Auth/me');
      setUser(res.data);
    } catch {
      localStorage.removeItem('smart_toeic_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshProfile();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthResponse>('/Auth/login', { email, password });
    localStorage.setItem('smart_toeic_token', res.data.accessToken);
    setUser(res.data.user);
  };

  const register = async (payload: { email: string; password: string; fullName: string; targetScore?: number }) => {
    const res = await api.post<AuthResponse>('/Auth/register', payload);
    localStorage.setItem('smart_toeic_token', res.data.accessToken);
    setUser(res.data.user);
  };

  const logout = () => {
    localStorage.removeItem('smart_toeic_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return ctx;
}
