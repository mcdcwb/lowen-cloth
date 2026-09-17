import { adaptProduct } from "../lib/products.ts";
import type { ManagedProduct, ProductInput } from "./products.ts";

export class ManagerApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
function normalize(value: unknown): ManagedProduct {
  const product = adaptProduct(value);
  const raw = value as Record<string, unknown>;
  return {
    ...product, imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : "", images: raw.images as string[],
    badge: typeof raw.badge === "string" ? raw.badge : null,
    colorName: typeof raw.colorName === "string" ? raw.colorName : null,
    colorValue: typeof raw.colorValue === "string" ? raw.colorValue : null
  };
}
export function createManagerApi(token: string, baseUrl = "/api", fetcher: typeof fetch = fetch) {
  async function request(path: string, method = "GET", body?: unknown, signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 15000);
    try {
      const response = await fetcher(baseUrl.replace(/\/$/, "") + "/produtos" + path, {
        method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal, cache: "no-store"
      });
      if (response.status === 401) throw new ManagerApiError(401, "Sua sessão expirou. Entre novamente.");
      if (response.status === 403) throw new ManagerApiError(403, "Acesso administrativo não autorizado.");
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const issues = Array.isArray(data?.errors) ? data.errors.map((issue: { message: string }) => issue.message).join(" ") : "";
        throw new ManagerApiError(response.status, issues || data?.error || "Não foi possível concluir a operação.");
      }
      return data;
    } catch (error) {
      if (error instanceof ManagerApiError) throw error;
      throw new ManagerApiError(0, "Falha de conexão. Verifique a lista antes de tentar novamente.");
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  }
  return {
    async list(signal?: AbortSignal) {
      const data = await request("", "GET", undefined, signal);
      if (!Array.isArray(data)) throw new ManagerApiError(0, "Resposta inválida do catálogo.");
      return data.map(normalize);
    },
    async save(input: ProductInput, id?: number) { return normalize(await request(id === undefined ? "" : `/${id}`, id === undefined ? "POST" : "PUT", input)); },
    async remove(id: number) { await request(`/${id}`, "DELETE"); }
  };
}
