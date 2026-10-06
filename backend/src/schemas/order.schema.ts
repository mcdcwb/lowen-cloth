import { z } from "zod";
export const orderIdSchema = z.coerce.number().int().positive().max(2147483647);
export const confirmOrderSchema = z.object({}).strict();
