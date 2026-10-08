import { stockBadge, type BadgeSelection, type StockBadgeSettings } from "../../../backend/src/lib/stock-badges.ts";

type BadgeProduct = { colors: readonly { id?: number; colorName?: string; variants: readonly { value?: string; stock: number }[] }[] };

/** Display stock only for an explicitly selected, valid combination. */
export function selectedStockBadge(product: BadgeProduct, settings: StockBadgeSettings | null, selection: BadgeSelection = {}) {
  const hasColor = product.colors.length > 1 || product.colors.some(color => color.colorName?.trim());
  const hasSize = product.colors.some(color => color.variants.some(variant => variant.value?.trim()));
  if ((!hasColor && !hasSize) || (hasColor && selection.colorId === undefined) || (hasSize && !selection.size)) return null;
  const colors = product.colors.filter(color => !hasColor || color.id === selection.colorId);
  if (colors.length !== 1) return null;
  const variants = colors[0].variants.filter(variant => !hasSize || variant.value === selection.size);
  if (variants.length !== 1 || variants[0].stock <= 0) return null;
  return stockBadge({ colors: [{ ...colors[0], variants }] }, settings);
}
