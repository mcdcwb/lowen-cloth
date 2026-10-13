import type { Request, Response } from "express";
import * as productService from "../services/product.service.js";
import { Prisma } from "../generated/prisma/client.js";
import {
    createProductSchema,
    carouselSchema,
    updateProductSchema
} from "../schemas/product.schema.js";

export async function setProductCarousel(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return res.status(400).json({ error: "ID inválido." });
    const result = carouselSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Informe se o produto pertence ao carrossel." });
    try {
        return res.json(await productService.setProductCarousel(id, result.data.inCarousel));
    } catch (error) {
        if (error instanceof productService.ProductError) return res.status(error.status).json({ error: error.message });
        console.error(error);
        return res.status(500).json({ error: "Não foi possível atualizar o carrossel." });
    }
}

export async function getProducts(req: Request, res: Response) {
    try {
        const products = await productService.getPublicProducts();

        res.set("Cache-Control", "no-store").json(products);
    } catch (error) {
        if (error instanceof productService.ProductError) return res.status(error.status).json({ error: error.message });
        console.error(error);

        res.status(500).json({
            error: "Erro ao buscar produtos."
        });
    }
}

export async function getAdminProducts(_req: Request, res: Response) {
    try { res.set("Cache-Control", "no-store").json(await productService.getProducts()); }
    catch (error) { console.error(error); res.status(500).json({ error: "Erro ao buscar produtos." }); }
}

export async function getCarouselProducts(_req: Request, res: Response) {
    try { res.set("Cache-Control", "no-store").json(await productService.getCarouselProducts()); }
    catch (error) { console.error(error); res.status(500).json({ error: "Erro ao buscar o carrossel." }); }
}

export async function createProduct(req: Request, res: Response) {
    try {
        const result = createProductSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "Dados inválidos.",
                errors: result.error.issues
            });
        }

        const product = await productService.createProduct(result.data);

        res.status(201).json(product);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return res.status(409).json({ error: "Categoria indisponível. Atualize a lista de categorias." });
        if (error instanceof productService.ProductError) return res.status(error.status).json({ error: error.message });
        console.error(error);

        res.status(500).json({
            error: "Erro ao criar produto."
        });
    }
}

export async function updateProduct(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);

        if (Number.isNaN(id)) {
            return res.status(400).json({
                error: "ID inválido."
            });
        }

        const existingProduct = await productService.getProductById(id);

        if (!existingProduct) {
            return res.status(404).json({
                error: "Produto não encontrado."
            });
        }

        const result = updateProductSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "Dados inválidos.",
                errors: result.error.issues
            });
        }

        const product = await productService.updateProduct(id, result.data);

        res.json(product);
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") return res.status(409).json({ error: "Categoria indisponível. Atualize a lista de categorias." });
        if (error instanceof productService.ProductError) return res.status(error.status).json({ error: error.message });
        console.error(error);

        res.status(500).json({
            error: "Erro ao atualizar produto."
        });
    }
}

export async function deleteProduct(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);

        if (Number.isNaN(id)) {
            return res.status(400).json({
                error: "ID inválido."
            });
        }

        const existingProduct = await productService.getProductById(id);

        if (!existingProduct) {
            return res.status(404).json({
                error: "Produto não encontrado."
            });
        }

        await productService.deleteProduct(id);

        res.json({
            message: "Produto excluído com sucesso."
        });
    } catch (error) {
        if (error instanceof productService.ProductError) return res.status(error.status).json({ error: error.message });
        console.error(error);

        res.status(500).json({
            error: "Erro ao excluir produto."
        });
    }
}
