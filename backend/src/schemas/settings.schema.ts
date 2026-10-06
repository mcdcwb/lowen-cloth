import { z } from "zod";

export const settingsSchema = z.object({
  lowStockThreshold: z.number().int().min(1).max(9999)
}).strict();

import { addressSchema } from "./account.schema.js";
import { normalizeWhatsapp } from "../lib/store-contact.js";

export const storeDetailsSchema = z.object({
  address: addressSchema.nullable(),
  whatsapp: z.string().trim().max(40).transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizeWhatsapp(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Informe um telefone brasileiro válido com DDD." });
      return z.NEVER;
    }
    return normalized;
  }).nullable()
}).strict();
