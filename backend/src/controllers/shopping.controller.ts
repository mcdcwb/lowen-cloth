import type { Request, Response } from "express";
import { z } from "zod";
import * as service from "../services/shopping.service.js";

const id = z.number().int().positive().max(2147483647);
const selection = z.object({ productId: id, size: z.string().trim().min(1).max(100), quantity: id }).strict();
export function shopping(action: "favorites" | "favorite" | "unfavorite" | "read" | "add" | "set" | "remove" | "clear" | "merge") {
    return async (req: Request, res: Response) => {
        try {
            const userId = res.locals.account.id as number;
            if (action === "favorites") return res.json(await service.favorites(userId));
            if (action === "favorite" || action === "unfavorite") {
                const productId = id.parse(Number(req.params.productId));
                return res.json(await service.favorite(userId, productId, action === "unfavorite"));
            }
            const items = action === "merge" ? z.object({ items: z.array(selection).max(200) }).strict().parse(req.body).items
                : action === "add" || action === "set" ? [selection.parse(req.body)]
                : action === "remove" ? [{ ...selection.omit({ quantity: true }).parse(req.body), quantity: 1 }] : [];
            return res.json(await service.cart(userId, action, items));
        } catch (error) {
            if (error instanceof z.ZodError) return res.status(400).json({ error: "Dados inválidos." });
            if (error instanceof service.ShoppingError) return res.status(error.status).json({ error: error.message });
            console.error(error);
            return res.status(500).json({ error: "Não foi possível atualizar seus dados. Tente novamente." });
        }
    };
}
