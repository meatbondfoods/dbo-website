// Pure helpers: apply admin display settings to ERP/demo products. Never touches price or stock.
import type { Product } from "../domain/types";
import type { ContentMap } from "./schema";

export function applyDisplay(products: Product[], display: ContentMap["productDisplay"]) {
  const byId = new Map(display.items.map((i) => [i.productId, i]));
  const visible = products
    .filter((p) => byId.get(p.id)?.visible ?? true)
    .map((p) => { const d = byId.get(p.id); return d?.promoLabel ? { ...p, badge: d.promoLabel } : p; })
    .sort((a, b) => (byId.get(a.id)?.sortOrder ?? 9999) - (byId.get(b.id)?.sortOrder ?? 9999));

  const flagged = (flag: "featured" | "bestSeller") => visible.filter((p) => byId.get(p.id)?.[flag]);
  const anyFeatured = display.items.some((i) => i.featured);
  const anyBest = display.items.some((i) => i.bestSeller);
  const featured = anyFeatured ? flagged("featured") : visible.filter((p) => p.availability !== "out_of_stock").slice(0, 4);
  const best = anyBest ? flagged("bestSeller") : visible.filter((p) => p.tags.includes("bestseller")).slice(0, 4);
  return { visible, featured: featured.slice(0, 8), best: best.slice(0, 8) };
}
