import { type BadgeSelection, type StockBadgeSettings } from "../../../backend/src/lib/stock-badges";
import type { Product } from "../lib/products";
import { ProductBadge, type BadgeSize } from "./ProductBadge";
import { selectedStockBadge } from "../lib/selected-stock-badge";

export function ProductBadges({ product, settings, selection, size = "default" }: { product: Product; settings: StockBadgeSettings | null; selection?: BadgeSelection; size?: BadgeSize }) {
  const automatic = selectedStockBadge(product, settings, selection);
  if (!product.badge && !automatic) return null;
  return <div className="store-product-badges pointer-events-none absolute top-0 -left-px right-0 z-10" aria-label="Badges do produto">
    {automatic && <ProductBadge size={size} label={automatic === "last-unit" ? "ÚLTIMA PEÇA" : "POUCAS UNIDADES"}
      background={automatic === "last-unit" ? "#B42332" : "#F4EC03"} color={automatic === "last-unit" ? "#FFFFFF" : "#121500"}
      className={`store-badge-automatic ${automatic === "last-unit" ? "store-stock-last" : "store-stock-low"}`} />}
    {product.badge && <ProductBadge size={size} label={product.badge} background={product.badgeBackgroundColor} color={product.badgeTextColor} className="store-badge-manual" />}
  </div>;
}
