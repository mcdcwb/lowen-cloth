import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
export interface StockConflict {
  variantId: number; productName: string; colorName: string; size: string; requested: number; available: number;
}
export class OrderError extends Error {
  constructor(public status: number, message: string, public conflicts?: StockConflict[]) { super(message); }
}
export async function confirmOrder(id: number) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    const order = await tx.order.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } } } });
    if (!order) throw new OrderError(404, "Pedido não encontrado.");
    if (order.status !== "PENDING_CONFIRMATION") throw new OrderError(409, "O pedido não está aguardando confirmação.");
    if (!order.items.length) throw new OrderError(409, "Pedido sem itens.");
    const ids = [...new Set(order.items.flatMap(item => item.variantId === null ? [] : [item.variantId]))].sort((a, b) => a - b);
    const variants = ids.length ? await tx.$queryRaw<{ id: number; stock: number }[]>(Prisma.sql`
      SELECT id, stock FROM "ProductVariant" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`) : [];
    const quantities = new Map<number, number>();
    for (const item of order.items) quantities.set(item.originalVariantId, (quantities.get(item.originalVariantId) ?? 0) + item.quantity);
    const conflicts = order.items.flatMap(item => {
      const available = variants.find(v => v.id === item.variantId)?.stock ?? 0;
      const requested = quantities.get(item.originalVariantId)!;
      return item.variantId === null || available < requested ? [{ variantId: item.originalVariantId,
        productName: item.productName, colorName: item.colorName, size: item.size, requested, available }] : [];
    });
    if (conflicts.length) throw new OrderError(409, "Estoque insuficiente para confirmar o pedido.", conflicts);
    for (const variantId of ids) {
      const quantity = order.items.filter(item => item.variantId === variantId).reduce((sum, item) => sum + item.quantity, 0);
      const updated = await tx.productVariant.updateMany({ where: { id: variantId, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } });
      if (updated.count !== 1) throw new OrderError(409, "O estoque mudou. Tente novamente.");
    }
    return tx.order.update({ where: { id }, data: { status: "PREPARING" }, select: { id: true, number: true, status: true, updatedAt: true } });
  }, { isolationLevel: "ReadCommitted" });
}
