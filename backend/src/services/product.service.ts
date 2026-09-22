import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import type { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { createProductSchema, updateProductSchema } from "../schemas/product.schema.js";
export const productInclude = { colors: { orderBy: [{ position: "asc" }, { id: "asc" }], include: { variants: { orderBy: { id: "asc" } } } } } satisfies Prisma.ProductInclude;
export class ProductError extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export const getProducts = () => prisma.product.findMany({ include: productInclude });
export const getProductById = (id: number) => prisma.product.findUnique({ where: { id }, include: productInclude });
export async function createProduct(data: z.infer<typeof createProductSchema>) {
    if (data.colors.some(c => c.id !== undefined || c.variants.some(v => v.id !== undefined)))
        throw new ProductError(400, "Novas cores e variantes não devem informar IDs.");
    const { colors, ...product } = data;
    return prisma.product.create({ data: { ...product, price: String(product.price), colors: { create: colors.map(({ variants, ...color }, position) => ({
        ...color, position, variants: { create: variants }
    })) } }, include: productInclude });
}
export async function updateProduct(id: number, data: z.infer<typeof updateProductSchema>) {
    return prisma.$transaction(async tx => {
        // All edits of this product are serialized; membership is checked inside the transaction.
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${id} FOR UPDATE`;
        const existing = await tx.product.findUnique({ where: { id }, include: productInclude });
        if (!existing) throw new ProductError(404, "Produto não encontrado.");
        const { colors, ...product } = data;
        if (colors) {
            for (const color of colors) {
                const old = existing.colors.find(c => c.id === color.id);
                if (color.id !== undefined && !old) throw new ProductError(400, "A cor não pertence a este produto.");
                if (color.variants.some(v => v.id !== undefined && !old?.variants.some(previous => previous.id === v.id)))
                    throw new ProductError(400, "A variante não pertence a esta cor.");
            }
            await tx.productColor.deleteMany({ where: { productId: id, id: { notIn: colors.flatMap(c => c.id === undefined ? [] : [c.id]) } } });
            for (const [position, color] of colors.entries()) {
                const { id: colorId, variants, ...fields } = color;
                if (colorId === undefined) {
                    await tx.productColor.create({ data: { ...fields, position, productId: id, variants: { create: variants } } });
                    continue;
                }
                await tx.productColor.update({ where: { id: colorId }, data: { ...fields, position } });
                const previous = existing.colors.find(c => c.id === colorId)!.variants;
                // Omitted variant IDs match by size for clients without IDs; explicit IDs preserve renames.
                const resolved = variants.map(v => ({ ...v, id: v.id ?? previous.find(p => p.value === v.value)?.id }));
                const keptIds = resolved.flatMap(v => v.id === undefined ? [] : [v.id]);
                if (new Set(keptIds).size !== keptIds.length) throw new ProductError(400, "Variante duplicada.");
                await tx.productVariant.deleteMany({ where: { colorId, id: { notIn: keptIds } } });
                // Temporarily free unique size labels, allowing swaps while retaining cart references.
                for (const v of resolved) if (v.id !== undefined && previous.find(p => p.id === v.id)?.value !== v.value)
                    await tx.productVariant.update({ where: { id: v.id }, data: { value: `__editing_${v.id}_${randomUUID()}` } });
                for (const { id: variantId, ...variant } of resolved) {
                    if (variantId === undefined) await tx.productVariant.create({ data: { ...variant, colorId } });
                    else await tx.productVariant.update({ where: { id: variantId }, data: variant });
                }
            }
        }
        return tx.product.update({ where: { id }, data: { ...product, ...(product.price === undefined ? {} : { price: String(product.price) }) }, include: productInclude });
    });
}
export const deleteProduct = (id: number) => prisma.product.delete({ where: { id } });
