import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";

export class ShoppingError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export const favorites = (userId: number) => prisma.favorite.findMany({
    where: { userId }, include: { product: { include: { variants: true } } }, orderBy: { productId: "asc" }
});
export async function favorite(userId: number, productId: number, remove = false) {
    if (remove) await prisma.favorite.deleteMany({ where: { userId, productId } });
    else {
        if (!await prisma.product.findUnique({ where: { id: productId } })) throw new ShoppingError(404, "Produto não encontrado.");
        await prisma.favorite.upsert({ where: { userId_productId: { userId, productId } }, create: { userId, productId }, update: {} });
    }
    return favorites(userId);
}
type Selection = { productId: number; size: string; quantity: number };
// Serializable transactions also protect against concurrent stock edits and cart writes.
export async function cart(userId: number, action: "read" | "add" | "set" | "remove" | "clear" | "merge", selections: Selection[] = []) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await prisma.$transaction(async tx => {
                // Serialize this account's cart operations, including repeated merge requests.
                await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
                const notices: string[] = [];
                if (action === "clear") await tx.cartItem.deleteMany({ where: { userId } });
                for (const item of selections) {
                    const variant = await tx.productVariant.findUnique({ where: { productId_value: { productId: item.productId, value: item.size } } });
                    if (!variant) {
                        if (action === "merge") { notices.push(`Produto ${item.productId}, tamanho ${item.size}: indisponível.`); continue; }
                        throw new ShoppingError(404, "Variante não encontrada.");
                    }
                    const where = { userId_variantId: { userId, variantId: variant.id } };
                    const previous = await tx.cartItem.findUnique({ where });
                    let quantity = action === "remove" ? 0 : action === "add" ? (previous?.quantity ?? 0) + item.quantity : item.quantity;
                    if (action === "merge") {
                        quantity = Math.min(variant.stock, Math.max(previous?.quantity ?? 0, item.quantity));
                        if (quantity < item.quantity) notices.push(`Produto ${item.productId}, tamanho ${item.size}: quantidade ajustada ao estoque (${quantity}).`);
                    } else if (quantity > variant.stock) throw new ShoppingError(409, "Quantidade superior ao estoque disponível.");
                    if (quantity === 0) await tx.cartItem.deleteMany({ where: { userId, variantId: variant.id } });
                    else await tx.cartItem.upsert({ where, create: { userId, variantId: variant.id, quantity }, update: { quantity } });
                }
                const rows = await tx.cartItem.findMany({ where: { userId }, include: { variant: { include: { product: { include: { variants: true } } } } }, orderBy: { variantId: "asc" } });
                const items = [];
                for (const row of rows) {
                    const quantity = Math.min(row.quantity, row.variant.stock);
                    if (quantity !== row.quantity) {
                        notices.push(`${row.variant.product.name}, tamanho ${row.variant.value}: quantidade ajustada ao estoque (${quantity}).`);
                        if (quantity) await tx.cartItem.update({ where: { userId_variantId: { userId, variantId: row.variantId } }, data: { quantity } });
                        else await tx.cartItem.delete({ where: { userId_variantId: { userId, variantId: row.variantId } } });
                    }
                    if (quantity) items.push({ product: row.variant.product, size: row.variant.value, quantity });
                }
                return { items, notices };
            }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 4) continue;
            throw error;
        }
    }
}
