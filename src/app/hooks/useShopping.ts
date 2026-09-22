import { useEffect, useRef, useState } from "react";
import { adaptProduct, selectProductColor, stockFor, type Product } from "../lib/products";

export interface CartItem { product: Product; colorId: number; size: string; quantity: number }
const key = "brecho_cart_v1";
function readGuest(): CartItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter(i => Number.isSafeInteger(i?.product?.id) && typeof i.size === "string" && Number.isSafeInteger(i.quantity) && i.quantity > 0) : [];
  } catch { return []; }
}
function saveGuest(items: CartItem[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* Guest cart still works in memory. */ }
}
export function useShopping(products: Product[], token: string | undefined, validating: boolean) {
  const [guest, setGuest] = useState(readGuest);
  const [account, setAccount] = useState<{ token: string; items: CartItem[]; favorites: Product[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const locked = useRef(false);
  const identity = useRef(token);
  identity.current = token;
  const guestRef = useRef(guest);
  guestRef.current = guest;
  async function request(path: string, method = "GET", body?: unknown) {
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
    const pendingGuest = guestRef.current;
    void (async () => {
      try {
        const [cart, favorites] = await Promise.all([
          pendingGuest.length ? request("/carrinho/sincronizar", "POST", { items: pendingGuest.map(i => ({ productId: i.product.id, colorId: i.colorId, size: i.size, quantity: i.quantity })) }) : request("/carrinho"),
          request("/favoritos")
        ]);
        if (current !== generation.current || identity.current !== token) return;
        setAccount({ token, items: adaptCart(cart), favorites: favorites.map((f: { product: unknown }) => adaptProduct(f.product)) });
        if (pendingGuest.length) {
          setGuest([]);
          saveGuest([]);
          setNotice(["Carrinho de visitante sincronizado: itens iguais mantêm a maior quantidade, limitada ao estoque.", ...cart.notices].join(" "));
        } else setNotice(cart.notices.join(" "));
      } catch (e) {
        if (current === generation.current) setError(e instanceof Error ? e.message : "Falha ao carregar seus dados.");
      } finally {
        if (current === generation.current) { locked.current = false; setBusy(false); }
      }
    })();
    return () => { generation.current++; };
  }, [token, validating, revision]);

  const guestItems = guest.reduce<CartItem[]>((items, item) => {
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
  const ready = !validating && (!token || account?.token === token);
  const items = validating ? [] : token ? account?.token === token ? account.items : [] : guestItems;
  const favorites = !validating && token && account?.token === token ? account.favorites : [];
  useEffect(() => {
    if (!token && !validating && products.length) {
      setGuest(guestItems);
      saveGuest(guestItems);
    }
  }, [products, token, validating]);
  async function mutate(path: string, method: string, body?: unknown) {
    if (!ready || locked.current) return false;
    const current = generation.current;
    locked.current = true;
    setBusy(true); setError("");
    try {
      const result = await request(path, method, body);
      if (current !== generation.current || identity.current !== token) return false;
      const update = path.startsWith("/favoritos")
        ? { favorites: result.map((f: { product: unknown }) => adaptProduct(f.product)) }
        : { items: adaptCart(result) };
      setAccount(previous => previous && ({ ...previous, ...update }));
      if (result.notices?.length) setNotice(result.notices.join(" "));
      return true;
    } catch (e) {
      if (current === generation.current) setError(e instanceof Error ? e.message : "Falha ao salvar.");
      return false;
    } finally {
      if (current === generation.current) { locked.current = false; setBusy(false); }
    }
  }
  function updateGuest(next: CartItem[]) { setGuest(next); saveGuest(next); }
  async function add(product: Product, size: string) {
    if (!ready || locked.current) return false;
    if (token) return mutate("/carrinho", "POST", { productId: product.id, colorId: product.colorId, size, quantity: 1 });
    const previous = guestItems.find(i => i.product.id === product.id && i.colorId === product.colorId && i.size === size);
    if ((previous?.quantity ?? 0) >= stockFor(product, size)) return false;
    updateGuest(previous ? guestItems.map(i => i === previous ? { ...i, quantity: i.quantity + 1 } : i) : [...guestItems, { product, colorId: product.colorId, size, quantity: 1 }]);
    return true;
  }
  function remove(productId: number, size: string, colorId: number) {
    if (!ready || locked.current) return;
    if (token) return void mutate("/carrinho/item", "DELETE", { productId, colorId, size });
    updateGuest(guestItems.filter(i => i.product.id !== productId || i.colorId !== colorId || i.size !== size));
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
  function clear() {
    if (!ready || locked.current) return;
    if (token) return void mutate("/carrinho", "DELETE");
    updateGuest([]);
  }
  return { items, favorites, busy, ready, error, notice, add, remove, changeQty, clear,
    dismissNotice: () => setNotice(""),
    retry: () => setRevision(v => v + 1),
    toggleFavorite: (productId: number) => mutate(`/favoritos/${productId}`, favorites.some(p => p.id === productId) ? "DELETE" : "PUT") };
}
