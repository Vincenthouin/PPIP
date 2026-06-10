import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiMe, Me, supabase } from "./supabase-client";

interface AuthState {
  loading: boolean;
  me: Me | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const loadMe = useCallback(async (accessToken: string | null) => {
    if (!accessToken) {
      setMe(null);
      return;
    }
    try {
      const data = await apiMe(accessToken);
      setMe(data);
    } catch (err) {
      console.log(`AuthProvider: failed to load /me — ${err}`);
      setMe(null);
    }
  }, []);

  useEffect(() => {
    const s = supabase();
    let unsub: (() => void) | null = null;
    (async () => {
      try {
        const { data } = await s.auth.getSession();
        const t = data.session?.access_token ?? null;
        tokenRef.current = t;
        setToken(t);
        await loadMe(t);
      } catch (err) {
        console.log(`AuthProvider initial session error: ${err}`);
      } finally {
        setLoading(false);
      }
      const sub = s.auth.onAuthStateChange(async (_event, session) => {
        const t = session?.access_token ?? null;
        tokenRef.current = t;
        setToken(t);
        await loadMe(t);
      });
      unsub = () => sub.data.subscription.unsubscribe();
    })();
    return () => {
      unsub?.();
    };
  }, [loadMe]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase().auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    if (error) {
      throw new Error(
        `Sign-in failed for ${email}: ${error.message}`,
      );
    }
    const t = data.session?.access_token ?? null;
    tokenRef.current = t;
    setToken(t);
    await loadMe(t);
  }, [loadMe]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    tokenRef.current = null;
    setToken(null);
    setMe(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const redirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase().auth.resetPasswordForEmail(
      email.toLowerCase().trim(),
      { redirectTo },
    );
    if (error) {
      throw new Error(
        `Password reset request failed for ${email}: ${error.message}`,
      );
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadMe(tokenRef.current);
  }, [loadMe]);

  const value = useMemo<AuthState>(
    () => ({ loading, me, token, signIn, signOut, resetPassword, refresh }),
    [loading, me, token, signIn, signOut, resetPassword, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
};
