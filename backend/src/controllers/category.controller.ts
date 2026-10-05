import type { Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { categorySchema } from "../schemas/category.schema.js";
import * as service from "../services/category.service.js";
function failure(error: unknown, res: Response) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return res.status(409).json({ error: "Já existe uma categoria com este nome." });
    if (error.code === "P2003") return res.status(409).json({ error: "Não é possível excluir esta categoria porque existem produtos associados a ela." });
    if (error.code === "P2025") return res.status(404).json({ error: "Categoria não encontrada." });
  }
  console.error(error);
  return res.status(500).json({ error: "Não foi possível concluir a operação de categoria." });
}
export async function listAvailableCategories(_req: Request, res: Response) {
  try { res.set("Cache-Control", "no-store").json(await service.getCategories(true)); } catch (error) { failure(error, res); }
}
export async function listCategories(_req: Request, res: Response) {
  try { res.set("Cache-Control", "no-store").json(await service.getCategories()); } catch (error) { failure(error, res); }
}
export async function saveCategory(req: Request, res: Response) {
  const id = req.params.id === undefined ? undefined : Number(req.params.id);
  if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647)) return res.status(400).json({ error: "ID inválido." });
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Nome de categoria inválido.", errors: parsed.error.issues });
  try {
    return res.status(id === undefined ? 201 : 200).json(id === undefined ? await service.createCategory(parsed.data.name) : await service.updateCategory(id, parsed.data.name));
  } catch (error) { return failure(error, res); }
}
export async function deleteCategory(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) return res.status(400).json({ error: "ID inválido." });
  try { await service.deleteCategory(id); return res.json({ message: "Categoria excluída com sucesso." }); }
  catch (error) { return failure(error, res); }
}
