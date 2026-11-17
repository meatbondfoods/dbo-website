import type { CartLine, Product } from "./domain/types";

export const FREE_DELIVERY_THRESHOLD = 1500;
export const DELIVERY_CHARGE = 80;

export class OrderValidationError extends Error {}

/** Server-side pricing: client-supplied prices are never trusted. */
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
  const deliveryCharge = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
  return { subtotal, deliveryCharge, total: subtotal + deliveryCharge };
}
