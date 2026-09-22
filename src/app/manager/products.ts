export const LOW_STOCK_LIMIT = 5;
export const categories = ["camisetas", "jaquetas", "calcas", "bermudas", "vestidos", "calcados"];
export const audiences = ["masculino", "feminino", "unissex", "infantil"];
export const labels: Record<string, string> = {
  camisetas: "Camisetas", jaquetas: "Jaquetas", calcas: "Calças", bermudas: "Bermudas", vestidos: "Vestidos", calcados: "Calçados",
  masculino: "Masculino", feminino: "Feminino", unissex: "Unissex", infantil: "Infantil"
};
export interface ColorInput {
  id?: number; colorName: string; colorValue: string; imageUrl: string; images: string[];
  variants: { id?: number; value: string; stock: number }[];
}
export interface ProductInput {
  name: string; description: string; price: number; public: string; category: string;
  badge: string | null; colors: ColorInput[];
}
export interface ManagedProduct extends ProductInput { id: number }
export interface ColorDraft {
  key: string; id?: number; colorName: string; colorValue: string; imageUrl: string; images: string;
  variants: { id?: number; value: string; stock: string }[];
}
export interface ProductDraft {
  name: string; description: string; price: string; public: string; category: string; badge: string;
  colors: ColorDraft[];
}
export const totalStock = (product: Pick<ProductInput, "colors">) => product.colors.reduce((sum, color) => sum + color.variants.reduce((n, v) => n + v.stock, 0), 0);
export const stockStatus = (stock: number) => stock === 0 ? "Sem estoque" : stock <= LOW_STOCK_LIMIT ? "Estoque baixo" : "Disponível";
export const normalizeHex = (value: string) => /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toUpperCase() : null;
export function productStats(products: ManagedProduct[]) {
  return { products: products.length, variants: products.reduce((n, p) => n + p.colors.reduce((n, c) => n + c.variants.length, 0), 0),
    empty: products.filter(p => totalStock(p) === 0).length, low: products.filter(p => totalStock(p) > 0 && totalStock(p) <= LOW_STOCK_LIMIT).length };
}
let nextColorKey = 0;
export function colorDraft(color?: ColorInput): ColorDraft {
  return { key: `color-${++nextColorKey}`, id: color?.id, colorName: color?.colorName ?? "", colorValue: normalizeHex(color?.colorValue ?? "") ?? color?.colorValue ?? "",
    imageUrl: color?.imageUrl ?? "", images: color?.images.join("\n") ?? "",
    variants: color?.variants.map(v => ({ ...v, stock: String(v.stock) })) ?? [{ value: "", stock: "0" }] };
}
export function toDraft(product?: ManagedProduct): ProductDraft {
  return { name: product?.name ?? "", description: product?.description ?? "", price: product ? String(product.price) : "",
    public: product?.public ?? "unissex", category: product?.category ?? "camisetas", badge: product?.badge ?? "",
    colors: product?.colors.map(colorDraft) ?? [colorDraft()] };
}
export function validateDraft(draft: ProductDraft): string[] {
  const errors: string[] = [];
  if (draft.name.trim().length < 3) errors.push("O nome deve ter pelo menos 3 caracteres.");
  if (!draft.price.trim() || !Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0) errors.push("Informe um preço maior que zero.");
  if (!draft.public.trim() || !draft.category.trim()) errors.push("Informe o público e a categoria.");
  if (!draft.colors.length) errors.push("Adicione pelo menos uma cor válida.");
  draft.colors.forEach((color, index) => {
    const prefix = `Cor ${index + 1} (${color.colorName || "sem nome"}): `;
    if (!color.colorName.trim()) errors.push(prefix + "informe o nome da cor.");
    if (!normalizeHex(color.colorValue)) errors.push(prefix + "informe o valor da cor no formato HEX #RRGGBB, por exemplo #1F2937.");
    const values = new Set<string>();
    color.variants.forEach((variant, i) => {
      const value = variant.value.trim();
      if (!value) errors.push(prefix + `variante ${i + 1}: informe um valor.`);
      if (values.has(value)) errors.push(prefix + `variante duplicada: ${value}.`);
      values.add(value);
      const stock = Number(variant.stock);
      if (!variant.stock.trim() || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) errors.push(prefix + `variante ${i + 1}: estoque deve ser inteiro entre 0 e 2147483647.`);
    });
  });
  return errors;
}
export function toInput(draft: ProductDraft): ProductInput {
  return { name: draft.name.trim(), description: draft.description, price: Number(draft.price), public: draft.public, category: draft.category,
    badge: draft.badge.trim() || null, colors: draft.colors.map(color => ({ id: color.id,
      colorName: color.colorName.trim(), colorValue: normalizeHex(color.colorValue)!, imageUrl: color.imageUrl.trim(),
      images: color.images.split(/\r?\n/).map(i => i.trim()).filter(Boolean),
      variants: color.variants.map(v => ({ id: v.id, value: v.value.trim(), stock: Number(v.stock) })) })) };
}
