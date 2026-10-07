import type { Request, Response } from "express";
import { orderIdSchema, confirmOrderSchema, advanceOrderSchema, cancelOrderSchema, orderListSchema } from "../schemas/order.schema.js";
import { confirmOrder, advanceOrder, cancelOrder, getOrder, listOrders, OrderError } from "../services/order.service.js";
export async function cancel(req: Request, res: Response) {
  const id = orderIdSchema.safeParse(req.params.id);
  const input = cancelOrderSchema.safeParse(req.body);
  if (!id.success || !input.success) return res.status(400).json({ error: "Pedido ou status esperado inválido." });
  try { return res.json(await cancelOrder(id.data, input.data.expectedStatus)); }
  catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ error: error.message });
    console.error(error); return res.status(500).json({ error: "Não foi possível cancelar o pedido. Tente novamente." });
  }
}
export async function advance(req: Request, res: Response) {
  const id = orderIdSchema.safeParse(req.params.id);
  const input = advanceOrderSchema.safeParse(req.body);
  if (!id.success || !input.success) return res.status(400).json({ error: "Pedido ou status esperado inválido." });
  try { return res.json(await advanceOrder(id.data, input.data.expectedStatus)); }
  catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ error: error.message });
    console.error(error); return res.status(500).json({ error: "Não foi possível atualizar o pedido. Tente novamente." });
  }
}
export async function list(req: Request, res: Response) {
  const input = orderListSchema.safeParse(req.query);
  if (!input.success) return res.status(400).json({ error: "Filtros ou paginação inválidos." });
  try { return res.json(await listOrders(input.data)); }
  catch (error) { console.error(error); return res.status(500).json({ error: "Não foi possível carregar os pedidos. Tente novamente." }); }
}
export async function details(req: Request, res: Response) {
  const id = orderIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({ error: "Pedido inválido." });
  try { return res.json(await getOrder(id.data)); }
  catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ error: error.message });
    console.error(error); return res.status(500).json({ error: "Não foi possível carregar os detalhes. Tente novamente." });
  }
}
export async function confirm(req: Request, res: Response) {
  const id = orderIdSchema.safeParse(req.params.id);
  if (!id.success || !confirmOrderSchema.safeParse(req.body ?? {}).success) return res.status(400).json({ error: "Pedido ou dados inválidos." });
  try { return res.json(await confirmOrder(id.data)); }
  catch (error) {
    if (error instanceof OrderError) return res.status(error.status).json({ error: error.message, conflicts: error.conflicts });
    console.error(error); return res.status(500).json({ error: "Não foi possível confirmar o pedido. Tente novamente." });
  }
}
