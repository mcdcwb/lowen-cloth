import type { Address } from "./address";
export { normalizeWhatsapp, formatWhatsapp, whatsappUrl } from "../../../backend/src/lib/store-contact";
export interface StoreDetails { address: Address | null; whatsapp: string | null }
export const emptyStoreDetails: StoreDetails = { address: null, whatsapp: null };
export async function storeDetailsRequest(token?: string, body?: StoreDetails, signal?: AbortSignal): Promise<StoreDetails> {
  const response = await fetch((import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "") + (token ? "/settings/store" : "/settings/public"), {
    method: body ? "PUT" : "GET", signal, cache: "no-store",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (response.status === 401 || response.status === 403) throw new Error("Sua sessão administrativa não está autorizada. Entre novamente.");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível acessar os dados da loja.");
  if (!(data.address === null || typeof data.address === "object") || !(data.whatsapp === null || typeof data.whatsapp === "string")) throw new Error("Dados da loja inválidos.");
  return data;
}
