import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middlewares/require-admin.js";
import { settingsSchema, storeDetailsSchema } from "../schemas/settings.schema.js";

import { storeDetailsSelect, publicStoreDetails, storeDetailsData } from "../services/settings.service.js";

export function createSettingsRoutes(database: Pick<typeof prisma, "storeSettings"> = prisma) {
  const router = Router();
  router.get("/public", async (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const row = await database.storeSettings.findUniqueOrThrow({ where: { id: 1 }, select: storeDetailsSelect });
      res.json(publicStoreDetails(row));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Não foi possível carregar os dados da loja." });
    }
  });
  router.all("/public", (_req, res) => { res.status(405).json({ error: "Método não permitido." }); });
  router.use(requireAdmin);
  router.get("/store", async (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      res.json(publicStoreDetails(await database.storeSettings.findUniqueOrThrow({ where: { id: 1 }, select: storeDetailsSelect })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Não foi possível carregar os dados da loja." });
    }
  });
  router.put("/store", async (req, res) => {
    const parsed = storeDetailsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || "Verifique os dados da loja.", errors: parsed.error.issues });
    try {
      const row = await database.storeSettings.update({ where: { id: 1 },
        data: storeDetailsData(parsed.data.address, parsed.data.whatsapp), select: storeDetailsSelect });
      res.json(publicStoreDetails(row));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Não foi possível salvar os dados da loja." });
    }
  });
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
