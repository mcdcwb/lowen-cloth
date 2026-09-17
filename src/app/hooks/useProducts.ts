import { useEffect, useState } from "react";
import { fetchProducts, type Product } from "../lib/products";

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setLoading(true);
    setError(null);
    fetchProducts(import.meta.env.VITE_API_URL || "/api", controller.signal)
      .then(data => { if (active) setProducts(data); })
      .catch(() => { if (active) setError("Não foi possível carregar os produtos. Tente novamente."); })
      .finally(() => { window.clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; window.clearTimeout(timeout); controller.abort(); };
  }, [attempt]);
  return { products, loading, error, retry: () => setAttempt(value => value + 1) };
}
