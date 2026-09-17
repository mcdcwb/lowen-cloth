import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createAuthApi, type RegisterInput } from "../lib/auth";
import { createAuthSession } from "../lib/auth-session";

export function useAuth() {
  const [api] = useState(() => createAuthApi(import.meta.env.VITE_API_URL || "/api"));
  const [auth] = useState(() => createAuthSession(api, () => window.sessionStorage, () => window.localStorage));
  const { session, error, validating } = useSyncExternalStore(auth.subscribe, auth.getSnapshot);

  useEffect(() => {
    void auth.restore();
    const revalidate = () => { if (document.visibilityState === "visible") void auth.restore(); };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      auth.cancelPending();
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [auth]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => auth.logout("Sua sessão expirou. Entre novamente."), Math.max(0, session.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [auth, session]);

  const user = useMemo(() => session ? session.account : null, [session]);
  const register = (input: RegisterInput, signal?: AbortSignal) => api.register(input, signal);
  const login = async (email: string, password: string, signal?: AbortSignal) => {
    const success = await auth.login(email, password, signal);
    return success ? auth.getSnapshot().session?.account ?? null : null;
  };
  return { user, accessToken: session?.accessToken, validating, sessionError: error, login, register, logout: auth.logout };
}
