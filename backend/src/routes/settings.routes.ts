import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middlewares/require-admin.js";
import { settingsSchema } from "../schemas/settings.schema.js";

export function createSettingsRoutes(database: Pick<typeof prisma, "storeSettings"> = prisma) {
  const router = Router();
  router.use(requireAdmin);
  router.get("/", async (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      res.json(await database.storeSettings.findUniqueOrThrow({ where: { id: 1 }, select: { lowStockThreshold: true } }));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Não foi possível carregar as configurações." });
    }
  });
  router.put("/", async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Informe um limite inteiro entre 1 e 9999.", errors: parsed.error.issues });
    try {
      return res.json(await database.storeSettings.update({ where: { id: 1 }, data: parsed.data, select: { lowStockThreshold: true } }));
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Não foi possível salvar as configurações." });
    }
  });
  return router;
}
