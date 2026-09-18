export const LOW_STOCK_LIMIT = 5;
export const categories = ["camisetas", "jaquetas", "calcas", "bermudas", "vestidos", "calcados"];
export const audiences = ["masculino", "feminino", "unissex", "infantil"];
export const labels: Record<string, string> = {
  camisetas: "Camisetas", jaquetas: "Jaquetas", calcas: "Calças", bermudas: "Bermudas", vestidos: "Vestidos", calcados: "Calçados",
  masculino: "Masculino", feminino: "Feminino", unissex: "Unissex", infantil: "Infantil"
};
export interface ProductInput {
  name: string; description: string; price: number; public: string; category: string;
  imageUrl: string; images: string[]; badge: string | null; colorName: string | null; colorValue: string | null;
  variants: { value: string; stock: number }[];
}
export interface ManagedProduct extends ProductInput { id: number }
export interface ProductDraft {
  name: string; description: string; price: string; public: string; category: string;
  imageUrl: string; images: string; badge: string; colorName: string; colorValue: string;
  variants: { value: string; stock: string }[];
}
export const totalStock = (product: Pick<ProductInput, "variants">) => product.variants.reduce((sum, variant) => sum + variant.stock, 0);
export const stockStatus = (stock: number) => stock === 0 ? "Sem estoque" : stock <= LOW_STOCK_LIMIT ? "Estoque baixo" : "Disponível";
export const normalizeHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : null;
export function productStats(products: ManagedProduct[]) {
  return {
    products: products.length,
    variants: products.reduce((sum, product) => sum + product.variants.length, 0),
    empty: products.filter(product => totalStock(product) === 0).length,
    low: products.filter(product => totalStock(product) > 0 && totalStock(product) <= LOW_STOCK_LIMIT).length
  };
}
export function toDraft(product?: ManagedProduct): ProductDraft {
  return {
    name: product?.name ?? "", description: product?.description ?? "", price: product ? String(product.price) : "",
    public: product?.public ?? "unissex", category: product?.category ?? "camisetas",
    imageUrl: product?.imageUrl ?? "", images: product?.images.join("\n") ?? "",
    badge: product?.badge ?? "", colorName: product?.colorName ?? "", colorValue: normalizeHex(product?.colorValue ?? "") ?? product?.colorValue ?? "",
    variants: product?.variants.map(v => ({ value: v.value, stock: String(v.stock) })) ?? [{ value: "", stock: "0" }]
  };
}
export function validateDraft(draft: ProductDraft): string[] {
  const errors: string[] = [];
  if (draft.colorValue.trim() && !normalizeHex(draft.colorValue)) errors.push("Informe o valor da cor no formato HEX #RRGGBB, por exemplo #1F2937.");
  if (draft.name.trim().length < 3) errors.push("O nome deve ter pelo menos 3 caracteres.");
  if (!draft.price.trim() || !Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0) errors.push("Informe um preço maior que zero.");
  if (!draft.public.trim() || !draft.category.trim()) errors.push("Informe o público e a categoria.");
  const values = new Set<string>();
  draft.variants.forEach((variant, index) => {
    const value = variant.value.trim();
    if (!value) errors.push(`Variante ${index + 1}: informe um valor.`);
    if (values.has(value)) errors.push(`Variante duplicada: ${value}.`);
    values.add(value);
    const stock = Number(variant.stock);
    if (!variant.stock.trim() || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) errors.push(`Variante ${index + 1}: estoque deve ser inteiro entre 0 e 2147483647.`);
  });
  return errors;
}
export function toInput(draft: ProductDraft): ProductInput {
  return {
    name: draft.name.trim(), description: draft.description, price: Number(draft.price), public: draft.public, category: draft.category,
    imageUrl: draft.imageUrl.trim(), images: draft.images.split(/\r?\n/).map(image => image.trim()).filter(Boolean),
    badge: draft.badge.trim() || null, colorName: draft.colorName.trim() || null, colorValue: normalizeHex(draft.colorValue),
    // Full replacement is intentional, including [] when all variants are removed.
    variants: draft.variants.map(v => ({ value: v.value.trim(), stock: Number(v.stock) }))
  };
}
