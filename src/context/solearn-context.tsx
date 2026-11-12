import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export type User = {
  id: number;
  name: string;
  email: string;
  referralCode: string;
  points: number;
  streak: number;
  lastRewardDate: string | null;
  canClaimDaily: boolean;
  canSpin: boolean;
};

export type Question = {
  id: string;
  subject: string;
  prompt: string;
  options: string[];
  points: number;
};

export type Activity = {
  id: number;
  type: string;
  description: string;
  points: number;
  createdAt: string;
  method?: "UPI" | "Gift card" | null;
  status?: "pending" | "completed" | "rejected" | null;
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  sessionError: string | null;
  request: <T>(path: string, options?: RequestOptions) => Promise<T>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, referralCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  retrySession: () => Promise<void>;
};

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL
  ?? (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000")
).replace(/\/+$/, "");
const TOKEN_KEY = "solearn-auth-token";

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function readToken() {
  if (Platform.OS === "web") {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeToken(token: string | null) {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    }
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function apiRequest<T>(
  path: string,
  token: string | null,
  options: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch (error) {
    const reason = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(
      `Could not connect to the SoloEarn API at ${API_URL}.${reason} Make sure the backend is running. On a physical device, set EXPO_PUBLIC_API_URL to your computer's LAN address and restart Expo.`,
    );
  }
  const data = await response.json() as { error?: string } & T;
  if (!response.ok) {
    throw new ApiError(data.error ?? "The request could not be completed.", response.status);
  }
  return data;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function SolearnProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const loadSession = useCallback(async (storedToken: string) => {
    const result = await apiRequest<{ user: User }>("/me", storedToken);
    setToken(storedToken);
    setUser(result.user);
    setSessionError(null);
  }, []);

  const retrySession = useCallback(async () => {
    setSessionError(null);
    setLoading(true);
    try {
      const storedToken = await readToken();
      if (!storedToken) {
        setToken(null);
        setUser(null);
        return;
      }
      await loadSession(storedToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await writeToken(null);
        setToken(null);
        setUser(null);
      } else {
        setSessionError(error instanceof Error ? error.message : "Could not connect to SoloEarn.");
      }
    } finally {
      setLoading(false);
    }
  }, [loadSession]);

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const storedToken = await readToken();
        if (!active || !storedToken) return;
        const result = await apiRequest<{ user: User }>("/me", storedToken);
        if (!active) return;
        setToken(storedToken);
        setUser(result.user);
        setSessionError(null);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          await writeToken(null);
          if (!active) return;
          setToken(null);
          setUser(null);
        } else {
          setSessionError(error instanceof Error ? error.message : "Could not connect to SoloEarn.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const request = useCallback(async <T,>(path: string, options?: RequestOptions) => {
    if (!token) throw new Error("Please sign in to continue.");
    return apiRequest<T>(path, token, options);
  }, [token]);

  const refreshUser = useCallback(async () => {
    const result = await request<{ user: User }>("/me");
    setUser(result.user);
  }, [request]);

  const authenticate = useCallback(async (path: string, body: Record<string, string>) => {
    const result = await apiRequest<{ token: string; user: User }>(path, null, {
      method: "POST",
      body,
    });
    await writeToken(result.token);
    setToken(result.token);
    setUser(result.user);
    setSessionError(null);
  }, []);

  const signIn = useCallback((email: string, password: string) => (
    authenticate("/auth/login", { email, password })
  ), [authenticate]);

  const signUp = useCallback((
    name: string,
    email: string,
    password: string,
    referralCode?: string,
  ) => authenticate("/auth/register", {
    name,
    email,
    password,
    ...(referralCode ? { referralCode } : {}),
  }), [authenticate]);

  const signOut = useCallback(async () => {
    await writeToken(null);
    setToken(null);
    setUser(null);
    setSessionError(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    sessionError,
    request,
    signIn,
    signUp,
    signOut,
    refreshUser,
    retrySession,
  }), [user, loading, sessionError, request, signIn, signUp, signOut, refreshUser, retrySession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSolearn() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useSolearn must be used inside SolearnProvider.");
  return context;
}
