import type { Request, Response } from "express";
import { orderIdSchema, confirmOrderSchema } from "../schemas/order.schema.js";
import { confirmOrder, OrderError } from "../services/order.service.js";
export async function confirm(req: Request, res: Response) {
  const id = orderIdSchema.safeParse(req.params.id);
  if (!id.success || !confirmOrderSchema.safeParse(req.body ?? {}).success) return res.status(400).json({ error: "Pedido ou dados inválidos." });
  try { return res.json(await confirmOrder(id.data)); }
  catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ error: error.message, conflicts: error.conflicts });
    console.error(error); return res.status(500).json({ error: "Não foi possível confirmar o pedido. Tente novamente." });
  }
}
