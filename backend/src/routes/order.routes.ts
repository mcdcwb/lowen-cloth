import { Router } from "express";
import { requireAdmin } from "../middlewares/require-admin.js";
import { confirm, list, details } from "../controllers/order.controller.js";
const router = Router();
router.use(requireAdmin);
router.get("/", list);
router.get("/:id", details);
router.post("/:id/confirm", confirm);
export default router;
