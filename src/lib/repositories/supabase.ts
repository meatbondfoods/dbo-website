import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Order, OrderInput, OrderStatus, Product } from "../domain/types.ts";
import { areaDistance, deliveryCharge, priceLines } from "../pricing.ts";
import { formatOrderReference, normalizeBdPhone } from "../identity.ts";
import { DEFAULTS } from "../content/defaults.ts";
import type { DeliveryConfig } from "../content/schema.ts";
import { computeHmacSignature } from "../server-hmac.ts";
import { MemoryDispatchStore, PgDispatchStore, runDispatchOnce, type DispatchStore } from "../order-dispatch.ts";
import { DEMO_PRODUCTS } from "../demo/data.ts";
import type { CatalogRepository, OrderRepository } from "./types.ts";

interface StoredOrderRecord {
  order: Order;
  requestHash: string;
}

// Fallback in-memory cache for when Supabase credentials are not configured or in unit test environment
const g = globalThis as unknown as { __martSupabaseOrders?: Map<string, StoredOrderRecord> };
const localStore = (g.__martSupabaseOrders ??= new Map<string, StoredOrderRecord>());

// Development/test queue only (not durable). With a configured website database the durable Postgres queue is used.
const gd = globalThis as unknown as { __martDispatchStore?: MemoryDispatchStore };
const localDispatchStore = (gd.__martDispatchStore ??= new MemoryDispatchStore());

const sameNumber = (a: string, b: string) => {
  const x = normalizeBdPhone(a);
  const y = normalizeBdPhone(b);
  return !!x && x === y;
};

function getCommerceConfig(): DeliveryConfig {
  try {
    const file = path.join(process.cwd(), ".data", "site-content.json");
    if (fs.existsSync(file)) {
      const db = JSON.parse(fs.readFileSync(file, "utf8"));
      if (db?.commerce?.published) return db.commerce.published as DeliveryConfig;
    }
  } catch {
    // ignore
  }
  return DEFAULTS.commerce;
}

/**
 * The website uses its OWN Supabase project only. It must never hold the ERP's URL or keys: the ERP
 * is reached only through the signed order API. Returns null when the website database is not
 * configured (orders then stay in the local fallback store).
 */
export function resolveWebsiteDb(env: Record<string, string | undefined>, isTest: boolean): { url: string; key: string } | null {
  if (isTest) return null;
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (url.includes("baifeezugzfkomjnmfgq")) {
    throw new Error("Refusing to start: the website is configured with the ERP's Supabase project.");
  }
  return url && key ? { url, key } : null;
}

export class SupabaseOrderRepository implements OrderRepository {
  private client: ReturnType<typeof createClient> | null = null;
  private products: Product[] = DEMO_PRODUCTS;
  private catalogRepo?: CatalogRepository;
  private dispatchStore: DispatchStore;

  constructor(products?: Product[], catalogRepo?: CatalogRepository, dispatchStore?: DispatchStore) {
    this.dispatchStore = dispatchStore ?? localDispatchStore;
    if (products) {
      this.products = products;
    }
    if (catalogRepo) {
      this.catalogRepo = catalogRepo;
    }
    const isTest = process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test" || process.argv.some((a) => a.includes("test"));
    const resolved = resolveWebsiteDb(process.env, isTest);
    const url = resolved?.url ?? null;
    const key = resolved?.key ?? null;
    if (url && key) {
      try {
        this.client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Could not initialize Supabase client, using resilient fallback:", err);
      }
    }
    if (!dispatchStore && this.client) this.dispatchStore = new PgDispatchStore(this.client as never);
  }

  async createOrder(input: OrderInput, idempotencyKey: string, customerId?: string): Promise<Order> {
    // 1. Check idempotency in local store or database
    if (this.client) {
      try {
        const { data: existing } = await (this.client as any).from("web_orders")
          .select("*, items:web_order_items(*)")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existing) {
          return this.mapDbRowToOrder(existing);
        }
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Error checking existing order in Supabase:", err);
      }
    }

    const cached = Array.from(localStore.values()).find((r) => r.order.idempotencyKey === idempotencyKey);
    if (cached) {
      return cached.order;
    }

    // 2. Server-side authoritative line pricing and validation. With a catalog repository (the ERP
    //    projection) its answer is final: there is no fallback to demo prices, so an empty or
    //    unreachable catalogue rejects the order instead of selling at invented prices.
    let activeCatalog = this.products;
    if (this.catalogRepo) {
      try {
        activeCatalog = await this.catalogRepo.listProducts();
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Error fetching live catalog for pricing:", err);
        activeCatalog = [];
      }
    }
    const { subtotal } = priceLines(input.lines, activeCatalog);
    const cfg = getCommerceConfig();
    const charge = deliveryCharge(subtotal, areaDistance(input.address.area, cfg), cfg);
    const total = subtotal + charge;
    const now = new Date();
    let reference = "";
    if (this.client) {
      try {
        const { data: refData, error: refErr } = await (this.client as any).rpc("next_web_order_ref");
        if (refData && !refErr) {
          reference = refData;
        }
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Error getting next_web_order_ref RPC:", err);
      }
    }
    if (!reference) {
      const orderSeq = localStore.size + 1;
      reference = formatOrderReference(now.getFullYear(), orderSeq);
    }
    const orderId = crypto.randomUUID();

    const order: Order = {
      id: orderId,
      reference,
      status: "pending_confirmation",
      createdAt: now.toISOString(),
      subtotal,
      deliveryCharge: charge,
      total,
      input,
      idempotencyKey,
      paymentStatus: "unpaid",
      deliveryStatus: cfg.active ? "calculated" : "to_be_confirmed",
      customerId,
    };

    // 3. Persist to Website Supabase database (if configured)
    if (this.client) {
      try {
        const { error: orderError } = await (this.client as any).from("web_orders").insert({
          id: order.id,
          order_ref: order.reference,
          web_customer_id: customerId || null,
          idempotency_key: idempotencyKey,
          request_hash: crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex"),
          payment_method: input.paymentMethod,
          payment_status: order.paymentStatus,
          delivery_name: input.customer.name,
          delivery_phone: normalizeBdPhone(input.customer.phone) || input.customer.phone,
          customer_email: input.customer.email || null,
          delivery_line1: input.address.line1,
          delivery_area: input.address.area,
          delivery_city: input.address.city,
          delivery_notes: input.address.notes || null,
          subtotal: order.subtotal,
          delivery_charge: order.deliveryCharge,
          delivery_status: order.deliveryStatus,
          total: order.total,
          status: "pending_confirmation",
          submitted_at: order.createdAt,
        });

        if (!orderError) {
          const itemsToInsert = input.lines.map((l) => {
            const prod = activeCatalog.find((p) => p.id === l.productId);
            const opt = prod?.options.find((o) => o.id === l.optionId);
            return {
              web_order_id: order.id,
              product_id: l.productId,
              product_name: prod?.name || "Product",
              unit: "kg",
              quantity: l.quantity,
              unit_price: opt?.price || 0,
              weight_grams: opt?.grams || null,
              option_label: opt?.label || null,
              option_id: opt?.id || null,
              line_total: (opt?.price || 0) * l.quantity,
            };
          });

          const { error: itemsError } = await (this.client as any).from("web_order_items").insert(itemsToInsert);
          if (itemsError) {
            // Never leave a half-saved order behind: remove it and fail the checkout.
            await (this.client as any).from("web_orders").delete().eq("id", order.id);
            throw new Error(`order items insert failed: ${itemsError.message}`);
          }
        } else {
          throw new Error(`order insert failed: ${orderError.message}`);
        }
      } catch (err) {
        // The order was NOT saved. Fail the checkout instead of reporting success for an order that
        // only exists in this server's memory (it would be lost and never reach the ERP).
        console.error("[SupabaseOrderRepository] could not save the order:", err instanceof Error ? err.message : err);
        throw new Error("Could not place order");
      }
    }

    // Always store in memory for resilient queries and local testing
    localStore.set(order.id, {
      order,
      requestHash: crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex"),
    });

    // 4. Secure server-to-server dispatch to ERP inbox API
    await this.dispatchToErp(order);

    return order;
  }

  /**
   * Transmits order to ERP receiving API with HMAC SHA-256 signature and replay protection timestamp.
   * If ERP is unavailable, logs a warning and does NOT fail customer checkout.
   */
  async dispatchToErp(order: Order): Promise<{ success: boolean; message?: string }> {
    let activeCatalog = this.products;
    if (this.catalogRepo) {
      try {
        activeCatalog = await this.catalogRepo.listProducts();
      } catch {
        activeCatalog = [];
      }
    }

    const payload = {
      orderRef: order.reference,
      idempotencyKey: order.idempotencyKey,
      customerId: order.customerId || null,
      customer: order.input.customer,
      address: order.input.address,
      paymentMethod: order.input.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      total: order.total,
      lines: order.input.lines.map((l) => {
        const prod = activeCatalog.find((p) => p.id === l.productId);
        const opt = prod?.options.find((o) => o.id === l.optionId);
        return {
          productId: l.productId,
          // The ERP variant id (synced catalog option ids are ERP variant ids); lines without a valid
          // one are held for staff review by the ERP, never matched by product name.
          variantId: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(l.optionId) ? l.optionId : undefined,
          optionId: l.optionId,
          productName: prod?.name || "Product",
          grams: opt?.grams || 1000,
          optionLabel: opt?.label || "1kg",
          unit: "kg",
          quantity: l.quantity,
          submittedUnitPrice: opt?.price || 0,
          lineTotal: (opt?.price || 0) * l.quantity,
        };
      }),
      submittedAt: order.createdAt,
    };

    // Queue first (the order is never lost), then make one immediate attempt. If the ERP is down or
    // not configured, the order stays queued and the dispatch worker keeps retrying it.
    const store = this.dispatchStore;
    try {
      await store.enqueue(order.reference, order.idempotencyKey, JSON.stringify(payload));
      const r = await runDispatchOnce({ store, workerId: "checkout" });
      return r.sent > 0 ? { success: true } : { success: false, message: "Queued for delivery to the ERP" };
    } catch (err) {
      console.error("[SupabaseOrderRepository] could not queue the order for the ERP:", err instanceof Error ? err.message : err);
      return { success: false, message: "Could not queue the order for the ERP" };
    }
  }

  async getOrderByReference(reference: string, phone: string): Promise<Order | null> {
    if (this.client) {
      try {
        const { data, error } = await (this.client as any).from("web_orders")
          .select("*, items:web_order_items(*)")
          .eq("order_ref", reference)
          .maybeSingle();

        if (data && !error) {
          const order = this.mapDbRowToOrder(data);
          if (sameNumber(order.input.customer.phone, phone)) {
            return order;
          }
        }
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Supabase getOrderByReference error:", err);
      }
    }

    const found = Array.from(localStore.values())
      .map((r) => r.order)
      .find((o) => o.reference === reference && sameNumber(o.input.customer.phone, phone));
    return found ?? null;
  }

  async listOrdersForPhone(phone: string): Promise<Order[]> {
    if (this.client) {
      try {
        const norm = normalizeBdPhone(phone);
        const { data } = await (this.client as any).from("web_orders")
          .select("*, items:web_order_items(*)")
          .or(`delivery_phone.eq.${phone},delivery_phone.eq.${norm || phone}`)
          .order("submitted_at", { ascending: false });

        if (data) {
          return data.map((d: any) => this.mapDbRowToOrder(d));
        }
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Supabase listOrdersForPhone error:", err);
      }
    }

    return Array.from(localStore.values())
      .map((r) => r.order)
      .filter((o) => sameNumber(o.input.customer.phone, phone))
      .reverse();
  }

  async listForCustomer(customerId: string, phone?: string, email?: string): Promise<Order[]> {
    if (this.client) {
      try {
        let query = (this.client as any).from("web_orders").select("*, items:web_order_items(*)");
        const filters: string[] = [];
        if (customerId) {
          filters.push(`web_customer_id.eq.${customerId}`);
        }
        if (phone) {
          const norm = normalizeBdPhone(phone);
          filters.push(`delivery_phone.eq.${phone}`);
          if (norm && norm !== phone) filters.push(`delivery_phone.eq.${norm}`);
        }
        if (email) {
          filters.push(`customer_email.eq.${email.trim().toLowerCase()}`);
        }

        if (filters.length > 0) {
          query = query.or(filters.join(","));
        }

        const { data, error } = await query.order("submitted_at", { ascending: false });

        if (data && !error) {
          return data.map((d: any) => this.mapDbRowToOrder(d));
        }
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Supabase listForCustomer error:", err);
      }
    }

    return Array.from(localStore.values())
      .map((r) => r.order)
      .filter((o) =>
        o.customerId === customerId ||
        (phone && sameNumber(o.input.customer.phone, phone)) ||
        (email && o.input.customer.email?.toLowerCase() === email.toLowerCase())
      )
      .reverse();
  }

  async listAll(): Promise<Order[]> {
    if (this.client) {
      try {
        const { data } = await (this.client as any).from("web_orders")
          .select("*, items:web_order_items(*)")
          .order("submitted_at", { ascending: false });

        if (data) {
          return data.map((d: any) => this.mapDbRowToOrder(d));
        }
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Supabase listAll error:", err);
      }
    }

    return Array.from(localStore.values())
      .map((r) => r.order)
      .reverse();
  }

  private mapDbRowToOrder(row: any): Order {
    return {
      id: row.id,
      reference: row.order_ref,
      status: row.status as OrderStatus,
      createdAt: row.submitted_at || row.created_at,
      subtotal: Number(row.subtotal),
      deliveryCharge: Number(row.delivery_charge),
      total: Number(row.total),
      paymentStatus: row.payment_status,
      deliveryStatus: row.delivery_status,
      deliveryDate: row.delivery_date ? String(row.delivery_date).split("T")[0] : undefined,
      customerId: row.web_customer_id || undefined,
      idempotencyKey: row.idempotency_key,
      input: {
        customer: {
          name: row.delivery_name || row.customer_name || "",
          phone: row.delivery_phone || row.customer_phone || "",
        },
        address: {
          line1: row.delivery_line1,
          area: row.delivery_area,
          city: row.delivery_city,
          notes: row.delivery_notes || undefined,
        },
        paymentMethod: row.payment_method,
        lines: (row.items || []).map((i: any) => ({
          productId: i.product_id,
          optionId: i.option_id || "",
          quantity: Number(i.quantity),
        })),
      },
    };
  }
}
