import { Router } from "express";
import { requireAuth } from "../middlewares/require-auth.js";
import { checkoutSchema } from "../schemas/checkout.schema.js";
import { CheckoutError, getCheckoutReview, prepareCheckoutWhatsapp } from "../services/checkout.service.js";
import { prisma } from "../lib/prisma.js";

export function createCheckoutRoutes(storeDatabase: Pick<typeof prisma, "storeSettings"> = prisma) {
  const router = Router();
  router.use(requireAuth, (_req, res, next) => {
    if (res.locals.account.role !== "USER") return res.status(403).json({ error: "Acesso exclusivo para clientes." });
    next();
  });
  router.get("/", async (_req, res) => {
    try { res.json(await getCheckoutReview(res.locals.account.id)); }
    catch (error) {
      if (error instanceof CheckoutError) return res.status(error.status).json({ error: error.message });
      console.error(error); res.status(500).json({ error: "Não foi possível conferir o carrinho. Tente novamente." });
    }
  });
  router.post("/whatsapp", async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Verifique a escolha de recebimento e os dados conferidos." });
    try { res.json(await prepareCheckoutWhatsapp(res.locals.account.id, parsed.data, storeDatabase)); }
    catch (error) {
      if (error instanceof CheckoutError) return res.status(error.status).json({ error: error.message, review: error.review });
      console.error(error); res.status(500).json({ error: "Não foi possível preparar a mensagem. Tente novamente." });
    }
  });
  return router;
}
