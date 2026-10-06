import { OrderStatus, type FulfillmentMethod } from "../../../backend/src/generated/prisma/enums.ts";
import { BUSINESS_TIME_ZONE } from "../../../backend/src/config/business.ts";
import type { Address } from "../lib/address.ts";
export type { OrderStatus };
export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "Aguardando confirmação", PREPARING: "Em preparação",
  READY_OR_SHIPPED: "Enviado / Pronto", COMPLETED: "Finalizado", CANCELLED: "Cancelado"
};
export interface OrderSummary {
  id: number; number: string; sequence: number; customerName: string; createdAt: string;
  total: string; fulfillmentMethod: FulfillmentMethod; status: OrderStatus;
}
export interface OrderDetails extends OrderSummary {
  updatedAt: string; deliveryAddress: Address | null; pickupAddress: Address | null;
  items: { id: number; productName: string; colorName: string; size: string; quantity: number; unitPrice: string; subtotal: string }[];
}
export interface OrderPage { items: OrderSummary[]; total: number; page: number; pageSize: number; totalPages: number }
export interface OrderQuery { search: string; status: OrderStatus | ""; sort: "date" | "number"; direction: "asc" | "desc"; page: number }
export interface StockConflict { variantId: number; productName: string; colorName: string; size: string; requested: number; available: number }
export function orderMoney(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("Valor do pedido inválido.");
  const [whole, cents = ""] = value.split(".");
  return `R$ ${BigInt(whole).toLocaleString("pt-BR")},${cents.padEnd(2, "0")}`;
}
export function orderDate(value: string, time = false) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: BUSINESS_TIME_ZONE, dateStyle: "short", ...(time ? { timeStyle: "short" } : {}) }).format(new Date(value));
}
export function orderQueryString(query: OrderQuery) {
  const params = new URLSearchParams({ sort: query.sort, direction: query.direction, page: String(query.page) });
  if (query.search.trim()) params.set("search", query.search.trim());
  if (query.status) params.set("status", query.status);
  return params.toString();
}
