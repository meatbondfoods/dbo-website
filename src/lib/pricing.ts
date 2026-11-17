import type { CartLine, Product } from "./domain/types";
import type { DeliveryConfig } from "./content/schema";

export class OrderValidationError extends Error {}

/** Server-side line pricing: client-supplied prices are never trusted. Returns the merchandise subtotal only. */
export function priceLines(lines: CartLine[], products: Product[]) {
  if (lines.length === 0) throw new OrderValidationError("Cart is empty");
  const byId = new Map(products.map((p) => [p.id, p]));
  let subtotal = 0;
  for (const line of lines) {
    const product = byId.get(line.productId);
    if (!product) throw new OrderValidationError(`Unknown product: ${line.productId}`);
    if (product.availability === "out_of_stock") throw new OrderValidationError(`${product.name} is out of stock`);
    const option = product.options.find((o) => o.id === line.optionId);
    if (!option) throw new OrderValidationError(`Invalid size for ${product.name}`);
    subtotal += option.price * line.quantity;
  }
  return { subtotal };
}

/** Distance (km) for a delivery area, or null when the area is not on the configured list. */
export function areaDistance(area: string, cfg: DeliveryConfig): number | null {
  const a = cfg.areas.find((x) => x.name.trim().toLowerCase() === area.trim().toLowerCase());
  return a ? a.distanceKm : null;
}

/**
 * Delivery charge. Free inside the free radius; otherwise the standard charge, unless the optional
 * free-over-amount rule applies. An unlisted area has unknown distance, so it is charged.
 */
export function deliveryCharge(subtotal: number, distanceKm: number | null, cfg: DeliveryConfig): number {
  if (!cfg.active) return 0;                 // policy not active: no charge is applied (the team confirms it)
  if (distanceKm !== null && distanceKm <= cfg.freeRadiusKm) return 0;
  if (cfg.freeOverAmount > 0 && subtotal >= cfg.freeOverAmount) return 0;
  return cfg.chargeBeyond;
}

/** One-line public summary of the delivery rule, generated from the configuration. */
export function deliverySummary(cfg: DeliveryConfig): string {
  if (!cfg.active) return "Delivery charge is confirmed by our team";
  const parts = [`Free delivery within ${cfg.freeRadiusKm} km`];
  parts.push(cfg.freeOverAmount > 0 ? `else ৳${cfg.chargeBeyond} (free over ৳${cfg.freeOverAmount.toLocaleString("en-BD")})` : `else ৳${cfg.chargeBeyond}`);
  return parts.join(", ");
}

/** Customer-facing sentence about delivery, correct for both states of the policy. */
export function deliveryNote(cfg: DeliveryConfig): string {
  return cfg.active
    ? `${deliverySummary(cfg)}. Your delivery charge is calculated at checkout from your delivery area.`
    : "Delivery charges have not been announced yet. Our team confirms the delivery charge for your address when confirming your order.";
}
