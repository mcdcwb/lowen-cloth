export type Size = string;
export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  public: string;
  category: string;
  imageUrl: string;
  images: string[];
  badge?: string;
  color: { name: string; value: string };
  sizes: Size[];
  variants: { value: string; stock: number }[];
}

export const productImagePlaceholder = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><rect width="800" height="1000" fill="#eeeae4"/><text x="400" y="500" text-anchor="middle" fill="#666" font-size="28">Imagem indisponível</text></svg>');

export function adaptProduct(value: unknown): Product {
  if (!value || typeof value !== "object") throw new Error("Produto inválido.");
  const p = value as Record<string, unknown>;
  const price = typeof p.price === "string" && p.price.trim() ? Number(p.price) : p.price;
  if (!Number.isSafeInteger(p.id) || Number(p.id) <= 0 || typeof p.name !== "string" ||
      typeof price !== "number" || !Number.isFinite(price) || price <= 0 ||
      typeof p.public !== "string" || typeof p.category !== "string" ||
      !Array.isArray(p.variants) || !Array.isArray(p.images) || !p.images.every(image => typeof image === "string")) {
    throw new Error("Produto inválido.");
  }
  const variants = p.variants.map((variant: unknown) => {
    if (!variant || typeof variant !== "object") throw new Error("Variante inválida.");
    const v = variant as Record<string, unknown>;
    if (typeof v.value !== "string" || !v.value.trim() || !Number.isSafeInteger(v.stock) || Number(v.stock) < 0) {
      throw new Error("Variante inválida.");
    }
    return { value: v.value, stock: v.stock as number };
  });
  if (new Set(variants.map(v => v.value)).size !== variants.length) throw new Error("Variante duplicada.");
  const images = [...new Set([
    ...(typeof p.imageUrl === "string" && p.imageUrl.trim() ? [p.imageUrl] : []),
    ...p.images.filter(image => image.trim())
  ])];
  if (!images.length) images.push(productImagePlaceholder);
  return {
    id: p.id as number, name: p.name, price, public: p.public, category: p.category,
    description: typeof p.description === "string" ? p.description : "",
    imageUrl: images[0], images,
    badge: typeof p.badge === "string" ? p.badge : undefined,
    color: { name: typeof p.colorName === "string" ? p.colorName : "Cor não informada", value: typeof p.colorValue === "string" ? p.colorValue : "transparent" },
    sizes: variants.map(v => v.value), variants
  };
}

export const stockFor = (product: Product, size: string) => product.variants.find(v => v.value === size)?.stock ?? 0;

export const isNumericSize = (size: string) => /^\d+$/.test(size);

export function catalogSizes(products: Product[]) {
  const clothing = ["PP", "P", "M", "G", "GG", "XG", "XGG"];
  return [...new Set(products.flatMap(p => p.variants.filter(v => v.stock > 0).map(v => v.value)))].sort((a, b) => {
    if (isNumericSize(a) !== isNumericSize(b)) return isNumericSize(a) ? 1 : -1;
    const ai = clothing.indexOf(a), bi = clothing.indexOf(b);
    if (ai >= 0 || bi >= 0) return ai < 0 ? 1 : bi < 0 ? -1 : ai - bi;
    return a.localeCompare(b, "pt-BR", { numeric: true });
  });
}

export async function fetchProducts(baseUrl = "/api", signal?: AbortSignal): Promise<Product[]> {
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/produtos", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível carregar os produtos. Tente novamente.");
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error("Resposta inválida do catálogo.");
  return body.map(adaptProduct);
}
