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
import { DEMO_PRODUCTS } from "../demo/data.ts";
import type { OrderRepository } from "./types.ts";

interface StoredOrderRecord {
  order: Order;
  requestHash: string;
}

// Fallback in-memory cache for when Supabase credentials are not configured or in unit test environment
const g = globalThis as unknown as { __martSupabaseOrders?: Map<string, StoredOrderRecord> };
const localStore = (g.__martSupabaseOrders ??= new Map<string, StoredOrderRecord>());

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

export class SupabaseOrderRepository implements OrderRepository {
  private client: ReturnType<typeof createClient> | null = null;
  private products: Product[] = DEMO_PRODUCTS;

  constructor(products?: Product[]) {
    if (products) {
      this.products = products;
    }
    const isTest = process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test" || process.argv.some((a) => a.includes("test"));
    const url = !isTest ? (process.env.ERP_SUPABASE_URL || "https://baifeezugzfkomjnmfgq.supabase.co") : (process.env.TEST_LIVE_DB === "true" ? "https://baifeezugzfkomjnmfgq.supabase.co" : null);
    const key = !isTest ? (process.env.ERP_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "") : (process.env.TEST_LIVE_DB === "true" ? (process.env.ERP_SUPABASE_KEY || "") : null);
    if (url && key) {
      try {
        this.client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Could not initialize Supabase client, using resilient fallback:", err);
      }
    }
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

    // 2. Server-side authoritative line pricing and validation
    const { subtotal } = priceLines(input.lines, this.products);
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
          customer_name: input.customer.name,
          customer_phone: normalizeBdPhone(input.customer.phone) || input.customer.phone,
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
            const prod = this.products.find((p) => p.id === l.productId);
            const opt = prod?.options.find((o) => o.id === l.optionId);
            return {
              web_order_id: order.id,
              product_id: l.productId,
              product_name: prod?.name || "Product",
              unit: "kg",
              quantity: l.quantity,
              submitted_unit_price: opt?.price || 0,
              grams: opt?.grams || null,
              option_label: opt?.label || null,
              option_id: opt?.id || null,
              line_total: (opt?.price || 0) * l.quantity,
            };
          });

          await (this.client as any).from("web_order_items").insert(itemsToInsert);
        } else {
          console.warn("[SupabaseOrderRepository] Database insert failed:", orderError.message);
        }
      } catch (err) {
        console.warn("[SupabaseOrderRepository] Supabase persistence error:", err);
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
    const erpUrl =
      process.env.ERP_INTEGRATION_URL ||
      (process.env.VERCEL_URL || process.env.NODE_ENV === "production"
        ? "https://meat-bond-foods-erp.vercel.app/api/integrations/web-orders"
        : "http://localhost:3001/api/integrations/web-orders");
    const secret = process.env.WEB_ORDER_INTEGRATION_SECRET || "meatbond-secure-integration-key-2026";
    const timestamp = Date.now();

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
        const prod = this.products.find((p) => p.id === l.productId);
        const opt = prod?.options.find((o) => o.id === l.optionId);
        return {
          productId: l.productId,
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

    const rawBody = JSON.stringify(payload);
    const signature = computeHmacSignature(rawBody, secret, timestamp);

    try {
      if (typeof fetch === "function") {
        const res = await fetch(erpUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-meatbond-signature": signature,
            "x-meatbond-timestamp": String(timestamp),
            "x-meatbond-idempotency-key": order.idempotencyKey,
          },
          body: rawBody,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn(`[SupabaseOrderRepository] ERP dispatch returned status ${res.status}: ${errText}`);
          return { success: false, message: `Status ${res.status}` };
        }

        return { success: true };
      }
      return { success: false, message: "Fetch not available in this environment" };
    } catch (err) {
      // Graceful degradation: do not throw error back to the customer checkout
      console.warn("[SupabaseOrderRepository] ERP endpoint offline or unreachable:", err instanceof Error ? err.message : err);
      return { success: false, message: err instanceof Error ? err.message : "Network error" };
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
          .or(`customer_phone.eq.${phone},customer_phone.eq.${norm || phone},delivery_phone.eq.${phone},delivery_phone.eq.${norm || phone}`)
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
          filters.push(`customer_id.eq.${customerId}`);
        }
        if (phone) {
          const norm = normalizeBdPhone(phone);
          filters.push(`customer_phone.eq.${phone}`);
          if (norm && norm !== phone) filters.push(`customer_phone.eq.${norm}`);
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
          name: row.customer_name || row.delivery_name || "",
          phone: row.customer_phone || row.delivery_phone || "",
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
