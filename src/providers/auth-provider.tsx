/**
 * Holds "who is signed in" for the whole app.
 * Screens read it with useAuth() instead of talking to storage or the API directly.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setAuthToken, type User } from '@/lib/api';
import { clearToken, getStoredToken, saveToken } from '@/lib/token-storage';

type Status = 'loading' | 'signedOut' | 'signedIn';

type AuthContextValue = {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: { name: string; email: string; password: string; referralCode?: string }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-fetch the user (points, streak...) after earning or spending. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const startSession = useCallback(async (token: string, nextUser: User) => {
    setAuthToken(token);
    await saveToken(token);
    setUser(nextUser);
    setStatus('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await clearToken();
    setUser(null);
    setStatus('signedOut');
  }, []);

  // On launch: restore a saved session if the server still accepts the token.
  useEffect(() => {
    (async () => {
      const token = await getStoredToken();
      if (!token) return setStatus('signedOut');
      setAuthToken(token);
      try {
        const { user: me } = await api.me();
        setUser(me);
        setStatus('signedIn');
      } catch (error) {
        // An expired or invalid token is discarded; a network error keeps it for next time.
        if (error instanceof ApiError && error.status === 401) await clearToken();
        setAuthToken(null);
        setStatus('signedOut');
      }
    })();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await api.me();
      setUser(me);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await signOut();
    }
  }, [signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      refreshUser,
      signOut,
      signIn: async (email, password) => {
        const { token, user: me } = await api.login({ email, password });
        await startSession(token, me);
      },
      signUp: async (input) => {
        const { token, user: me } = await api.register(input);
        await startSession(token, me);
      },
    }),
    [status, user, refreshUser, signOut, startSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
