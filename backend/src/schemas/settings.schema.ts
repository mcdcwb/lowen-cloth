import { z } from "zod";

export const settingsSchema = z.object({
  lowStockThreshold: z.number().int().min(1).max(9999)
}).strict();
