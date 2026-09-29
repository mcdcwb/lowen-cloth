import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { adaptProduct, selectProductColor, stockFor, type Product } from "../lib/products";
import type { Account } from "../lib/auth";
import { AUTH_STORAGE_KEY } from "../lib/auth-session";

export interface CartItem { product: Product; colorId: number; size: string; quantity: number }
// v1 mixed administrator and visitor items: never guess their owner on upgrade.
const key = "brecho_guest_cart_v2";
const pendingPrefix = "brecho_guest_pending_v2:";
const shoppingChangeKey = "lowen-cloth_shopping_change_v1";
function readGuest(storageKey = key): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? value.filter(i => Number.isSafeInteger(i?.product?.id) && typeof i.size === "string" && Number.isSafeInteger(i.quantity) && i.quantity > 0) : [];
  } catch { return []; }
}
function saveGuest(items: CartItem[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* Guest cart still works in memory. */ }
}
export function useShopping(products: Product[], accessToken: string | undefined, validating: boolean, user: Account | null) {
  const token = user?.role === "USER" ? accessToken : undefined;
  const owner = user ? `${user.role}:${user.id}` : "guest";
  // Trigger renders on local/storage changes, but read the shared snapshot below
  // so an undelivered storage event cannot resurrect an already imported cart.
  const [, setGuest] = useState<CartItem[]>([]);
  const [adminCart, setAdminCart] = useState<{ owner: string; token: string | undefined; items: CartItem[] } | null>(null);
  const [account, setAccount] = useState<{ token: string; items: CartItem[]; favorites: Product[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const locked = useRef(false);
  const identity = useRef(accessToken);
  identity.current = accessToken;
  useEffect(() => { setAdminCart(null); }, [accessToken, owner]);
  function isCurrent() {
    if (identity.current !== accessToken || validating) return false;
    try { return (JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) ?? "null")?.accessToken) === accessToken; }
    catch { return false; }
  }
  function announce() {
    try { localStorage.setItem(shoppingChangeKey, crypto.randomUUID()); } catch { /* No cross-tab storage. */ }
  }
  useEffect(() => {
    const refresh = (event?: StorageEvent) => {
      if (event && event.storageArea !== localStorage) return;
      if (!event || event.key === key || event.key === null) setGuest(readGuest());
      if (!event || event.key === shoppingChangeKey || event.key === null) setRevision(v => v + 1);
    };
    const focus = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", focus);
    return () => { window.removeEventListener("storage", refresh); window.removeEventListener("focus", focus); };
  }, []);
  async function request(path: string, method = "GET", body?: unknown) {
    if (!isCurrent()) throw new Error("A sessão mudou. Aguarde a atualização da conta.");
    const response = await fetch((import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "") + path, {
      method, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await response.json().catch(() => { throw new Error("Resposta inválida do servidor. Tente novamente."); });
    if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar. Tente novamente.");
    return data;
  }
  const adaptCart = (data: { items: CartItem[] }) => data.items.map(i => ({ ...i, product: selectProductColor(adaptProduct(i.product), i.colorId) }));
  useEffect(() => {
    const current = ++generation.current;
    locked.current = false;
    setAccount(null);
    setError("");
    setNotice("");
    setBusy(false);
    if (!token || validating) return;
    locked.current = true;
    setBusy(true);
    void (async () => {
      try {
        // A shared lock and persistent owner claim prevent two identities from
        // importing the same guest cart, including after a failed/late request.
        const loadCart = async () => {
          if (current !== generation.current || !isCurrent()) return null;
          const pendingKey = pendingPrefix + owner;
          const pendingGuest = [...readGuest(pendingKey), ...readGuest()];
          if (!pendingGuest.length) return null;
          // Move the snapshot to this verified identity before any network I/O.
          // Failures remain retryable only by this USER; a new visitor can start
          // a fresh cart without inheriting or modifying the pending snapshot.
          localStorage.setItem(pendingKey, JSON.stringify(pendingGuest));
          localStorage.setItem(key, "[]");
          setGuest([]);
          const cart = await request("/carrinho/sincronizar", "POST", { items: pendingGuest.map(i => ({ productId: i.product.id, colorId: i.colorId, size: i.size, quantity: i.quantity })) });
          // Consume a confirmed merge even if its account logged out meanwhile.
          localStorage.removeItem(pendingKey);
          return { ...cart, notices: ["Carrinho de visitante sincronizado: itens iguais mantêm a maior quantidade, limitada ao estoque.", ...cart.notices] };
        };
        const loadAccountCart = async () => {
          let merged = null;
          if (readGuest().length || readGuest(pendingPrefix + owner).length) {
            if (!navigator.locks) throw new Error("Para sincronizar o carrinho entre abas, use um navegador atualizado e uma conexão HTTPS.");
            merged = await navigator.locks.request("lowen-cloth-guest-merge", loadCart);
          }
          if (current !== generation.current || !isCurrent()) return null;
          // Ordinary account reads must not hold the cross-tab guest lock.
          return merged ?? request("/carrinho");
        };
        const [cart, favorites] = await Promise.all([
          loadAccountCart(),
          request("/favoritos")
        ]);
        if (!cart || current !== generation.current || !isCurrent()) return;
        setAccount({ token, items: adaptCart(cart), favorites: favorites.map((f: { product: unknown }) => adaptProduct(f.product)) });
        setNotice(cart.notices.join(" "));
      } catch (e) {
        if (current === generation.current) setError(e instanceof Error ? e.message : "Falha ao carregar seus dados.");
      } finally {
        if (current === generation.current) { locked.current = false; setBusy(false); }
      }
    })();
    return () => { generation.current++; };
  }, [accessToken, owner, validating, revision]);

  const localItems = user?.role === "ADMIN" ? adminCart?.owner === owner && adminCart.token === accessToken ? adminCart.items : [] : readGuest();
  const guestItems = localItems.reduce<CartItem[]>((items, item) => {
    const base = products.find(p => p.id === item.product.id);
    if (!base) return items;
    const colorId = item.colorId ?? base.colors[0].id;
    if (!base.colors.some(c => c.id === colorId)) return items;
    const product = selectProductColor(base, colorId);
    const previous = items.find(i => i.product.id === product.id && i.colorId === colorId && i.size === item.size);
    const quantity = Math.min(stockFor(product, item.size), (previous?.quantity ?? 0) + item.quantity);
    if (previous) previous.quantity = quantity;
    else if (quantity > 0) items.push({ product, colorId, size: item.size, quantity });
    return items;
  }, []);
  const ready = !validating && isCurrent() && (!token || account?.token === token);
  const items = !ready ? [] : token ? account?.token === token ? account.items : [] : guestItems;
  const favorites = ready && token && account?.token === token ? account.favorites : [];
  useEffect(() => {
    if (!user && !validating && products.length && isCurrent()) {
      setGuest(guestItems);
      saveGuest(guestItems);
    }
  }, [products, accessToken, validating]);
  async function mutate(path: string, method: string, body?: unknown) {
    if (!token || !ready || locked.current || !isCurrent()) return false;
    const current = generation.current;
    locked.current = true;
    setBusy(true); setError("");
    try {
      const result = await request(path, method, body);
      if (current !== generation.current || !isCurrent()) return false;
      const update = path.startsWith("/favoritos")
        ? { favorites: result.map((f: { product: unknown }) => adaptProduct(f.product)) }
        : { items: adaptCart(result) };
      setAccount(previous => previous && ({ ...previous, ...update }));
      if (result.notices?.length) setNotice(result.notices.join(" "));
      announce();
      return true;
    } catch (e) {
      if (current === generation.current) setError(e instanceof Error ? e.message : "Falha ao salvar.");
      return false;
    } finally {
      if (current === generation.current) { locked.current = false; setBusy(false); }
    }
  }
  function updateGuest(next: CartItem[]) {
    if (!isCurrent()) return;
    if (user?.role === "ADMIN") { setAdminCart({ owner, token: accessToken, items: next }); return; }
    setGuest(next); saveGuest(next);
  }
  async function add(product: Product, size: string) {
    if (!ready || locked.current) return false;
    if (token) {
      if (!await mutate("/carrinho", "POST", { productId: product.id, colorId: product.colorId, size, quantity: 1 })) return false;
      toast.success(`${product.name} — tamanho ${size} foi adicionado ao carrinho.`);
      return true;
    }
    const previous = guestItems.find(i => i.product.id === product.id && i.colorId === product.colorId && i.size === size);
    if ((previous?.quantity ?? 0) >= stockFor(product, size)) return false;
    updateGuest(previous ? guestItems.map(i => i === previous ? { ...i, quantity: i.quantity + 1 } : i) : [...guestItems, { product, colorId: product.colorId, size, quantity: 1 }]);
    toast.success(`${product.name} — tamanho ${size} foi adicionado ao carrinho.`);
    return true;
  }
  async function remove(productId: number, size: string, colorId: number) {
    if (!ready || locked.current) return;
    const item = items.find(i => i.product.id === productId && i.colorId === colorId && i.size === size);
    if (!item) return;
    if (token) {
      if (!await mutate("/carrinho/item", "DELETE", { productId, colorId, size })) return;
    } else updateGuest(guestItems.filter(i => i.product.id !== productId || i.colorId !== colorId || i.size !== size));
    toast.success(`${item.product.name} — tamanho ${size} foi removido do carrinho.`);
  }
  function changeQty(productId: number, size: string, delta: number, colorId: number) {
    if (!ready || locked.current) return;
    const item = items.find(i => i.product.id === productId && i.colorId === colorId && i.size === size);
    if (!item) return;
    const quantity = item.quantity + delta;
    if (quantity <= 0) return remove(productId, size, colorId);
    if (token) return void mutate("/carrinho", "PATCH", { productId, colorId, size, quantity });
    updateGuest(guestItems.map(i => i === item ? { ...i, quantity: Math.min(stockFor(i.product, size), quantity) } : i));
  }
  async function clear() {
    if (!ready || locked.current || !items.length) return;
    if (token) {
      if (!await mutate("/carrinho", "DELETE")) return;
    } else updateGuest([]);
    toast.success("Carrinho esvaziado com sucesso.");
  }
  return { items, favorites, busy, ready, error, notice, add, remove, changeQty, clear,
    dismissNotice: () => setNotice(""),
    retry: () => setRevision(v => v + 1),
    toggleFavorite: (productId: number) => mutate(`/favoritos/${productId}`, favorites.some(p => p.id === productId) ? "DELETE" : "PUT") };
}
