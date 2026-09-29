import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createManagerApi, ManagerApiError } from "./api";
import type { ManagedProduct, ProductInput } from "./products";

export function useManagerProducts(token: string, onUnauthorized: (message: string) => void, onChanged: () => void) {
  const api = useMemo(() => createManagerApi(token, import.meta.env.VITE_API_URL || "/api"), [token]);
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const pending = useRef(false);
  const mounted = useRef(true);
  const callbacks = useRef({ onUnauthorized, onChanged });
  callbacks.current = { onUnauthorized, onChanged };
  const fail = useCallback((reason: unknown) => {
    if (reason instanceof ManagerApiError && [401, 403].includes(reason.status)) {
      callbacks.current.onUnauthorized(reason.message);
    } else setError(reason instanceof Error ? reason.message : "Não foi possível concluir a operação.");
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api.list(controller.signal).then(data => { if (!controller.signal.aborted) { setProducts(data); setLoaded(true); } })
      .catch(reason => { if (!controller.signal.aborted) fail(reason); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, revision, fail]);

  async function mutate(action: () => Promise<void>) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      callbacks.current.onChanged();
      return mounted.current;
    } catch (reason) {
      if (mounted.current) fail(reason);
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const save = (input: ProductInput, id?: number) => mutate(async () => {
    const product = await api.save(input, id);
    if (!mounted.current) return;
    setProducts(previous => id === undefined ? [...previous, product] : previous.map(p => p.id === id ? product : p));
    toast.success(id === undefined ? "Produto criado com sucesso!" : "Produto salvo com sucesso!");
  });
  const remove = (id: number) => mutate(async () => {
    await api.remove(id);
    if (!mounted.current) return;
    setProducts(previous => previous.filter(product => product.id !== id));
    toast.success("Produto excluído com sucesso!");
  });
  const upload = async (file: File, signal: AbortSignal) => {
    try { return await api.upload(file, signal); }
    catch (reason) {
      if (!signal.aborted && reason instanceof ManagerApiError && [401, 403].includes(reason.status)) callbacks.current.onUnauthorized(reason.message);
      throw reason;
    }
  };
  return { upload, products, loading, loaded, busy, error, save, remove, reload: () => setRevision(value => value + 1) };
}
