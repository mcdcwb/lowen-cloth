import type { Account, AuthSession, createAuthApi } from "./auth";

export const AUTH_STORAGE_KEY = "lowen-cloth_auth_v1";
export const LEGACY_USER_KEY = "brecho_user_v1";

type StorageAccess = () => Pick<Storage, "getItem" | "setItem" | "removeItem">;
type State = { session: AuthSession | null; error: string | null; validating: boolean };

export function createAuthSession(
  api: ReturnType<typeof createAuthApi>,
  storage: StorageAccess,
  legacyStorage: StorageAccess
) {
  let state: State = { session: null, error: null, validating: true };
  let generation = 0;
  const listeners = new Set<() => void>();

  function publish(session: AuthSession | null, error: string | null = null, validating = false) {
    state = { session, error, validating };
    listeners.forEach(listener => listener());
  }
  function clearStorage() {
    try { storage().removeItem(AUTH_STORAGE_KEY); } catch { /* Storage may be blocked. */ }
  }
  function save(session: AuthSession) {
    try {
      storage().setItem(AUTH_STORAGE_KEY, JSON.stringify({
        accessToken: session.accessToken, expiresAt: session.expiresAt
      }));
    } catch { /* The verified session can still live in memory for this page. */ }
  }
  function read() {
    try {
      const value = JSON.parse(storage().getItem(AUTH_STORAGE_KEY) ?? "null");
      if (value && typeof value.accessToken === "string" && value.accessToken.trim() &&
          Number.isFinite(value.expiresAt)) return {
        accessToken: value.accessToken as string, expiresAt: value.expiresAt as number
      };
    } catch { /* Malformed or inaccessible storage cannot authenticate anyone. */ }
    return null;
  }

  function logout(error: string | null = null) {
    generation++;
    clearStorage();
    publish(null, error);
  }

  async function login(email: string, password: string, signal?: AbortSignal) {
    const current = ++generation;
    clearStorage();
    publish(null, null, true);
    try {
      const session = await api.login(email, password, signal);
      if (current !== generation || signal?.aborted) return false;
      save(session);
      publish(session);
      return true;
    } catch (error) {
      if (current === generation) {
        clearStorage();
        publish(null, error instanceof Error ? error.message : "Não foi possível entrar.");
      }
      throw error;
    }
  }

  async function restore() {
    try { legacyStorage().removeItem(LEGACY_USER_KEY); } catch { /* Ignore old mock identity. */ }
    const saved = state.session ?? read();
    if (!saved) {
      clearStorage();
      publish(null, state.error);
      return;
    }
    if (saved.expiresAt <= Date.now()) {
      logout("Sua sessão expirou. Entre novamente.");
      return;
    }
    const current = ++generation;
    // Returning from a native file picker revalidates on focus. Keep an already
    // verified session mounted so its form/input and pending upload survive.
    // Initial restoration still blocks access until /auth/me succeeds.
    if (!state.session) publish(null, null, true);
    try {
      const account = await api.me(saved.accessToken);
      if (current !== generation) return;
      if (saved.expiresAt <= Date.now()) {
        logout("Sua sessão expirou. Entre novamente.");
        return;
      }
      publish({ ...saved, account });
    } catch (error) {
      if (current !== generation) return;
      logout(error instanceof Error ? error.message : "Não foi possível validar a sessão.");
    }
  }

  return {
    login, restore, logout,
    updateAccount(accessToken: string, account: Account) {
      const session = state.session;
      if (!session || session.accessToken !== accessToken || session.account.id !== account.id || session.account.role !== account.role) return;
      publish({ ...session, account });
    },
    getSnapshot: () => state,
    cancelPending: () => { generation++; },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}
