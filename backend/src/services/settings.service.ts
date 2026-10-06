import type { StoreSettings } from "../generated/prisma/client.js";

export const storeDetailsSelect = {
  storeCep: true, storeStreet: true, storeNumber: true, storeComplement: true,
  storeNeighborhood: true, storeCity: true, storeState: true, whatsapp: true
} as const;
type Details = Pick<StoreSettings, keyof typeof storeDetailsSelect>;
export function publicStoreDetails(row: Details) {
  const address = row.storeCep && row.storeStreet && row.storeNumber && row.storeNeighborhood && row.storeCity && row.storeState
    ? { cep: row.storeCep, street: row.storeStreet, number: row.storeNumber, complement: row.storeComplement ?? "",
        neighborhood: row.storeNeighborhood, city: row.storeCity, state: row.storeState } : null;
  return { address, whatsapp: row.whatsapp };
}
export function storeDetailsData(address: { cep: string; street: string; number: string; complement: string; neighborhood: string; city: string; state: string } | null, whatsapp: string | null) {
  return { storeCep: address?.cep ?? null, storeStreet: address?.street ?? null, storeNumber: address?.number ?? null,
    storeComplement: address?.complement ?? null, storeNeighborhood: address?.neighborhood ?? null,
    storeCity: address?.city ?? null, storeState: address?.state ?? null, whatsapp };
}
