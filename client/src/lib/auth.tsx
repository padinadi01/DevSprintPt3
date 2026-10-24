import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  apiGetMe,
  apiLogin,
  apiQuickSwitch,
  type AuthUser,
  type UserRole,
} from '../api/auth';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  role: UserRole | null;
  isPemilik: boolean;
  isStaf: boolean;
  isLoggedIn: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (username: string, pin: string) => Promise<void>;
  quickSwitch: (username: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? !!localStorage.getItem('auth_token') : false;
  });

  // Sync token to localStorage
  const saveAuth = (newToken: string | null, newUser: AuthUser | null) => {
    setToken(newToken);
    setUser(newUser);
    if (newToken) {
      localStorage.setItem('auth_token', newToken);
      localStorage.removeItem('auth_guest');
    } else {
      localStorage.removeItem('auth_token');
      localStorage.setItem('auth_guest', 'true');
    }
  };

  const refreshUser = async () => {
    const currentToken = localStorage.getItem('auth_token');

    if (currentToken) {
      try {
        const { user: me } = await apiGetMe();
        setUser(me);
        setToken(currentToken);
        setIsLoading(false);
        return;
      } catch {
        // Token expired or invalid
        localStorage.removeItem('auth_token');
      }
    }

    setUser(null);
    setToken(null);
    setIsLoading(false);
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (username: string, pin: string) => {
    setIsLoading(true);
    try {
      const res = await apiLogin(username, pin);
      saveAuth(res.token, res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const quickSwitch = async (username: string) => {
    setIsLoading(true);
    try {
      const res = await apiQuickSwitch(username);
      saveAuth(res.token, res.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    saveAuth(null, null);
  };

  const role = user?.role ?? null;
  const isPemilik = role === 'PEMILIK';
  const isStaf = role === 'STAF';
  const isLoggedIn = user !== null;

  const hasPermission = (permission: string): boolean => {
    if (isPemilik) return true;
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      role,
      isPemilik,
      isStaf,
      isLoggedIn,
      isLoading,
      hasPermission,
      login,
      quickSwitch,
      logout,
      refreshUser,
    }),
    [user, token, role, isPemilik, isStaf, isLoggedIn, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
