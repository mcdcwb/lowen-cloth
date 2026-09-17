import type { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type {
    createProductSchema,
    updateProductSchema
} from "../schemas/product.schema.js";

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = z.infer<typeof updateProductSchema>;

export async function getProducts() {
    return prisma.product.findMany({ include: { variants: true } });
}

export async function getProductById(id: number) {
    return prisma.product.findUnique({ where: { id }, include: { variants: true } });
}

export async function createProduct(data: CreateProductInput) {
    const { variants, ...product } = data;
    return prisma.product.create({
        data: { ...product, variants: { create: variants } },
        include: { variants: true }
    });
}

export async function updateProduct(id: number, data: UpdateProductInput) {
    const { variants, ...product } = data;
    return prisma.product.update({
        where: { id },
        data: {
            ...product,
            ...(variants === undefined ? {} : {
                variants: {
                    deleteMany: { value: { notIn: variants.map(variant => variant.value) } },
                    upsert: variants.map(variant => ({
                        where: { productId_value: { productId: id, value: variant.value } },
                        create: variant,
                        update: { stock: variant.stock }
                    }))
                }
            })
        },
        include: { variants: true }
    });
}

export async function deleteProduct(id: number) {
    return prisma.product.delete({ where: { id } });
}
