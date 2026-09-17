import { z } from "zod";

export const productVariantSchema = z.object({
    value: z.string().trim().min(1, "Informe o valor da variante."),
    stock: z.number().int().min(0).max(2147483647)
});

const variantsSchema = z.array(productVariantSchema).superRefine((variants, ctx) => {
    const values = new Set<string>();
    variants.forEach((variant, index) => {
        if (values.has(variant.value)) {
            ctx.addIssue({ code: "custom", path: [index, "value"], message: "Valor de variante duplicado." });
        }
        values.add(variant.value);
    });
});

export const createProductSchema = z.strictObject({
    name: z
        .string()
        .min(3, "O nome deve possuir pelo menos 3 caracteres"),

    description: z
        .string()
        .optional(),

    price: z
        .number()
        .positive("O preço deve ser maior que zero"),

    variants: variantsSchema,

    public: z.string().trim().min(1),
    category: z.string().trim().min(1),
    images: z.array(z.string().trim().min(1)),
    badge: z.string().nullable().optional(),
    colorName: z.string().nullable().optional(),
    colorValue: z.string().nullable().optional(),

    imageUrl: z
        .string()
        .optional()
});

export const updateProductSchema = createProductSchema
    .partial()
    .refine(
        (data) => Object.keys(data).length > 0,
        {
            message: "Informe pelo menos um campo para atualizar."
        }
    );
