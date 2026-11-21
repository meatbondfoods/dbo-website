import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "../demo/data.ts";
import type { Order, OrderInput, OrderStatus } from "../domain/types.ts";
import { areaDistance, deliveryCharge, priceLines } from "../pricing.ts";
import { formatOrderReference, normalizeBdPhone } from "../identity.ts";
import { getContent } from "../content/store.ts";
import type { CatalogRepository, OrderRepository } from "./types.ts";

export class DemoCatalogRepository implements CatalogRepository {
  async listCategories() { return DEMO_CATEGORIES; }
  async listProducts() { return DEMO_PRODUCTS; }
  async getProductBySlug(slug: string) { return DEMO_PRODUCTS.find((p) => p.slug === slug) ?? null; }
}

// In-memory only: demo orders reset when the server restarts. Never used with real data.
// Held on globalThis so every route bundle (dev compiles them separately) shares one list.
const g = globalThis as unknown as { __martDemoOrders?: Order[] };
const orders: Order[] = (g.__martDemoOrders ??= []);
const sameNumber = (a: string, b: string) => { const x = normalizeBdPhone(a), y = normalizeBdPhone(b); return !!x && x === y; };

export class DemoOrderRepository implements OrderRepository {
  async createOrder(input: OrderInput, idempotencyKey: string, customerId?: string): Promise<Order> {
    const existing = orders.find((o) => o.idempotencyKey === idempotencyKey);
    if (existing) return existing; // duplicate submission returns the original order
    const { subtotal } = priceLines(input.lines, DEMO_PRODUCTS);
    // Delivery rule always comes from PUBLISHED settings (never a draft, never the client).
    const cfg = getContent("commerce");
    const charge = deliveryCharge(subtotal, areaDistance(input.address.area, cfg), cfg);
    const order: Order = {
      id: crypto.randomUUID(),
      reference: formatOrderReference(new Date().getFullYear(), orders.length + 1),
      status: "pending_confirmation", createdAt: new Date().toISOString(),
      subtotal, deliveryCharge: charge, total: subtotal + charge, input, idempotencyKey,
      // Payment is never marked paid by the website. Cash on delivery stays "unpaid" until the ERP records payment.
      paymentStatus: "unpaid", deliveryStatus: cfg.active ? "calculated" : "to_be_confirmed", customerId,
    };
    orders.push(order);
    return order;
  }
  async getOrderByReference(reference: string, phone: string) {
    return orders.find((o) => o.reference === reference && sameNumber(o.input.customer.phone, phone)) ?? null;
  }
  async listOrdersForPhone(phone: string) { return orders.filter((o) => sameNumber(o.input.customer.phone, phone)); }
  async listForCustomer(customerId: string, phone?: string, email?: string) {
    return orders
      .filter((o) =>
        o.customerId === customerId ||
        (phone && sameNumber(o.input.customer.phone, phone)) ||
        (email && o.input.customer.email?.toLowerCase() === email.toLowerCase())
      )
      .reverse();
  }
  async listAll() { return [...orders].reverse(); }
}

/** DEMO ONLY: stands in for ERP staff progressing an order, so the tracking timeline can be exercised in development. */
export function simulateStatus(reference: string, status: OrderStatus): Order | null {
  const o = orders.find((x) => x.reference === reference);
  if (!o) return null;
  o.status = status;
  return o;
}
