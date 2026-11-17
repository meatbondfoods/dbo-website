import type { Order } from "./domain/types";

/** What a customer is allowed to see about an order (no idempotency key, no internal ids, no other customers' data). */
export function toTracked(o: Order) {
  return {
    reference: o.reference, status: o.status, createdAt: o.createdAt, subtotal: o.subtotal,
    deliveryCharge: o.deliveryCharge, deliveryStatus: o.deliveryStatus, total: o.total,
    paymentMethod: o.input.paymentMethod, paymentStatus: o.paymentStatus, lines: o.input.lines,
  };
}
