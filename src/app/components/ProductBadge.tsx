export const badgeDefaults = { background: "#2457A7", text: "#FFFFFF" };
export const badgeShape = "M0,507.7H1394.5c132.4,0,397.5,386.7,397.5,386.7s-265.1,389.9-397.5,389.9H0V507.7z";

export function ProductBadge({ label, background = badgeDefaults.background, color = badgeDefaults.text, className = "" }: {
  label: string; background?: string; color?: string; className?: string;
}) {
  const automatic = className.includes("store-badge-automatic");
  return <span className={`product-tag ${className}`} title={label}
    {...(automatic ? { tabIndex: 0, role: "note", "aria-label": label } : {})}
    style={{ width: `${Math.max(62, label.length * 6 + 24) * (className.includes("store-stock-low") ? 0.85 : className.includes("store-stock-last") || className.includes("store-badge-manual") ? 1.12 : 1)}px`, color }}>
    {/* Keep the original path; only automatic tags compress vertically at their fixed width. */}
    <svg viewBox="0 0 1792 1792" preserveAspectRatio={automatic ? "none" : undefined} aria-hidden="true" focusable="false"><path d={badgeShape} fill={background} /></svg>
    <span className="product-tag-label"><span>{label}</span></span>
  </span>;
}
