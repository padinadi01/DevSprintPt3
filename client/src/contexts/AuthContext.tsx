import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getSession,
  getSetupStatus,
  login as loginRequest,
  logout as logoutRequest,
  quickSwitch as quickSwitchRequest,
  returnToOwner as returnToOwnerRequest,
  setupOwner as setupOwnerRequest,
  type AppUser,
} from '../api/auth';
import { ApiError } from '../api/http';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  setupRequired: boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  login: (username: string, pin: string) => Promise<void>;
  setupOwner: (username: string, displayName: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  quickSwitch: (targetUserId: string) => Promise<void>;
  returnToOwner: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.all([getSession().then((result) => result.user), getSetupStatus()])
      .then(([sessionUser, setup]) => {
        if (!mounted) return;
        setUser(sessionUser);
        setSetupRequired(setup.setupRequired);
      })
      .catch(async (error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error('Gagal memeriksa sesi login.', error);
          return;
        }
        try {
          const setup = await getSetupStatus();
          if (!mounted) return;
          setUser(null);
          setSetupRequired(setup.setupRequired);
        } catch (statusError) {
          console.error('Gagal memeriksa status setup akun.', statusError);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (username: string, pin: string) => {
    const result = await loginRequest({ username, pin });
    setUser(result.user);
    setSetupRequired(false);
  }, []);

  const setupOwner = useCallback(async (username: string, displayName: string, pin: string) => {
    const result = await setupOwnerRequest({ username, displayName, pin });
    setUser(result.user);
    setSetupRequired(false);
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setSetupRequired(false);
  }, []);

  const quickSwitch = useCallback(async (targetUserId: string) => {
    const result = await quickSwitchRequest(targetUserId);
    setUser(result.user);
  }, []);

  const returnToOwner = useCallback(async () => {
    const result = await returnToOwnerRequest();
    setUser(result.user);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = user?.permissions ?? [];
    return {
      user,
      loading,
      setupRequired,
      hasPermission: (permission) => permissions.includes(permission),
      hasAnyPermission: (requested) => requested.some((permission) => permissions.includes(permission)),
      login,
      setupOwner,
      logout,
      quickSwitch,
      returnToOwner,
    };
  }, [user, loading, setupRequired, login, setupOwner, logout, quickSwitch, returnToOwner]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}
