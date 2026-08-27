import { z } from "zod";

export const createProductSchema = z.object({
    name: z
        .string()
        .min(3, "O nome deve possuir pelo menos 3 caracteres"),

    description: z
        .string()
        .optional(),

    price: z
        .number()
        .positive("O preço deve ser maior que zero"),

    stock: z
        .number()
        .int()
        .min(0, "O estoque não pode ser negativo"),

    imageUrl: z
        .string()
        .optional()
});