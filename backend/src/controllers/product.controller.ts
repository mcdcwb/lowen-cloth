import type { Request, Response } from "express";
import * as productService from "../services/product.service.js";
import {
    createProductSchema,
    updateProductSchema
} from "../schemas/product.schema.js";

export async function getProducts(req: Request, res: Response) {
    try {
        const products = await productService.getProducts();

        res.json(products);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro ao buscar produtos."
        });
    }
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
        console.error(error);

        res.status(500).json({
            error: "Erro ao excluir produto."
        });
    }
}
