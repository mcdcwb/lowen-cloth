import { Router } from "express";
import { requireAdmin } from "../middlewares/require-admin.js";
import { confirm } from "../controllers/order.controller.js";
const router = Router();
router.use(requireAdmin);
router.post("/:id/confirm", confirm);
export default router;
