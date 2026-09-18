import type { Account } from "./auth";

export interface Address { cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string }
export interface Profile { account: Account; address: Address | null }
export const emptyAddress: Address = { cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" };
export const formatCep = (value: string) => value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2");
export async function accountRequest<T>(token: string, method = "GET", body?: unknown, path = "/conta", signal?: AbortSignal): Promise<T> {
  const response = await fetch((import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "") + path, {
    method, signal, cache: "no-store", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => { throw new Error("Resposta inválida do servidor. Tente novamente."); });
  if (!response.ok) throw new Error(data.error || "Não foi possível salvar. Tente novamente.");
  return data;
}

export async function lookupCep(cep: string, signal: AbortSignal): Promise<Pick<Address, "street" | "neighborhood" | "city" | "state">> {
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal });
  if (!response.ok) throw new Error("Consulta de CEP indisponível. Preencha o endereço manualmente.");
  const data = await response.json();
  if (data.erro) throw new Error("CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.");
  if (![data.logradouro, data.bairro, data.localidade, data.uf].every(value => typeof value === "string")) throw new Error("Resposta de CEP inválida. Preencha o endereço manualmente.");
  return { street: data.logradouro, neighborhood: data.bairro, city: data.localidade, state: data.uf };
}
