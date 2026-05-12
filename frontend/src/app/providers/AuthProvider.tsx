import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiRequest, type AuthUser } from '@/shared/api/client';
import { authService } from './auth.service';

interface AuthContextType {
  user: AuthUser | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  register: (data: { email: string; password: string; name?: string; username?: string }) => Promise<boolean>;
  logout: () => void;
  isAdmin: boolean;
  isOperator: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      setLoading(false);
      return;
    }

    apiRequest<AuthUser>('/auth/me', undefined, false)
      .then((profile) => setUser(profile))
      .catch(() => authService.logout())
      .finally(() => setLoading(false));
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const result = await authService.login({ identifier, password });
      setUser(result.user);
      return true;
    } catch (error) {
      console.error('Login failed', error);
      return false;
    }
  };

  const register = async (data: { email: string; password: string; name?: string; username?: string }) => {
    try {
      const result = await authService.register(data);
      setUser(result.user);
      return true;
    } catch (error) {
      console.error('Register failed', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    authService.logout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        isAdmin: user?.role === 'admin',
        isOperator: user?.role === 'operator' || user?.role === 'admin',
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
};
