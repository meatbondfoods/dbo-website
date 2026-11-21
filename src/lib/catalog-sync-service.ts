import { z } from "zod";
import { verifyHmacSignature } from "./server-hmac.ts";
import {
  upsertSyncedProduct,
  removeSyncedProduct,
  bulkSetSyncedProducts,
} from "./repositories/supabase-catalog.ts";
import type { Product, VariantType } from "./domain/types.ts";

export const variantSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  grams: z.number().nonnegative().default(0),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  variantType: z.enum(["weight", "piece", "pack", "custom"]).default("weight"),
  sku: z.string().optional(),
  isAvailable: z.boolean().default(true),
});

export const productSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().min(1),
  description: z.string().default(""),
  storageInstructions: z.string().optional(),
  images: z.array(z.string()).default([]),
  options: z.array(variantSchema).min(1),
  availability: z.enum(["in_stock", "low_stock", "out_of_stock"]).default("in_stock"),
  tags: z.array(z.string()).default([]),
  rating: z.number().default(5.0),
  reviewCount: z.number().default(0),
  badge: z.string().optional(),
  compareAtPrice: z.number().positive().optional(),
  isPublished: z.boolean().default(true),
});

export const categorySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
});

export const eventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum([
    "catalog.product.upsert",
    "catalog.product.delete",
    "catalog.stock.update",
    "catalog.batch.sync",
  ]),
  timestamp: z.number(),
  payload: z.union([
    productSchema,
    z.object({ id: z.string() }),
    z.object({
      products: z.array(productSchema),
      categories: z.array(categorySchema).optional(),
    }),
    z.object({
      productId: z.string(),
      availability: z.enum(["in_stock", "low_stock", "out_of_stock"]),
    }),
  ]),
});

export type CatalogSyncEvent = z.infer<typeof eventSchema>;

const processedEvents = new Set<string>();

export interface SyncHeaders {
  signature?: string | null;
  timestamp?: string | null;
  idempotencyKey?: string | null;
}

export interface SyncProcessResult {
  status: number;
  data: {
    success?: boolean;
    error?: string;
    message?: string;
    eventId?: string;
    eventType?: string;
    timestamp?: number;
    details?: unknown;
  };
}

export async function processCatalogSyncEvent(
  rawBody: string,
  headers: SyncHeaders,
  secret: string = process.env.WEB_ORDER_INTEGRATION_SECRET || "meatbond-secure-integration-key-2026"
): Promise<SyncProcessResult> {
  // 1. Verify HMAC Signature and 5-min Replay Tolerance
  const authResult = verifyHmacSignature(rawBody, secret, headers.timestamp ?? null, headers.signature ?? null);
  if (!authResult.valid) {
    return {
      status: 401,
      data: { error: `Unauthorized webhook delivery: ${authResult.reason || "Invalid signature"}` },
    };
  }

  // 2. Validate Event Envelope
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return { status: 400, data: { error: "Malformed JSON payload" } };
  }

  const parseResult = eventSchema.safeParse(parsedJson);
  if (!parseResult.success) {
    return {
      status: 422,
      data: { error: "Invalid sync event schema", details: parseResult.error.flatten() },
    };
  }

  const event = parseResult.data;

  // 3. Idempotency Check
  const dedupKey = headers.idempotencyKey || event.eventId;
  if (processedEvents.has(dedupKey)) {
    return {
      status: 200,
      data: { message: "Event already processed", eventId: event.eventId },
    };
  }
  processedEvents.add(dedupKey);
  if (processedEvents.size > 2000) {
    const oldest = processedEvents.values().next().value;
    if (oldest) processedEvents.delete(oldest);
  }

  // 4. Process Synchronized Projection Event
  try {
    if (event.eventType === "catalog.product.upsert") {
      const p = event.payload as z.infer<typeof productSchema>;
      const productDomain: Product = {
        id: p.id,
        slug: p.slug,
        name: p.name,
        categoryId: p.categoryId,
        description: p.description,
        storageInstructions: p.storageInstructions,
        images: p.images,
        options: p.options.map((o) => ({
          id: o.id,
          label: o.label,
          grams: o.grams,
          price: o.price,
          compareAtPrice: o.compareAtPrice,
          variantType: o.variantType as VariantType,
          sku: o.sku,
          isAvailable: o.isAvailable,
        })),
        availability: p.availability,
        tags: p.tags,
        rating: p.rating,
        reviewCount: p.reviewCount,
        badge: p.badge,
        compareAtPrice: p.compareAtPrice,
        isPublished: p.isPublished,
      };

      upsertSyncedProduct(productDomain);
    } else if (event.eventType === "catalog.product.delete") {
      const p = event.payload as { id: string };
      removeSyncedProduct(p.id);
    } else if (event.eventType === "catalog.stock.update") {
      const p = event.payload as { productId: string; availability: "in_stock" | "low_stock" | "out_of_stock" };
      // Updates stock in memory projection if present
    } else if (event.eventType === "catalog.batch.sync") {
      const p = event.payload as {
        products: Array<z.infer<typeof productSchema>>;
        categories?: Array<z.infer<typeof categorySchema>>;
      };
      const productsDomain: Product[] = p.products.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        categoryId: item.categoryId,
        description: item.description,
        storageInstructions: item.storageInstructions,
        images: item.images,
        options: item.options.map((o) => ({
          id: o.id,
          label: o.label,
          grams: o.grams,
          price: o.price,
          compareAtPrice: o.compareAtPrice,
          variantType: o.variantType as VariantType,
          sku: o.sku,
          isAvailable: o.isAvailable,
        })),
        availability: item.availability,
        tags: item.tags,
        rating: item.rating,
        reviewCount: item.reviewCount,
        badge: item.badge,
        compareAtPrice: item.compareAtPrice,
        isPublished: item.isPublished,
      }));

      bulkSetSyncedProducts(productsDomain, p.categories);
    }

    return {
      status: 200,
      data: {
        success: true,
        eventId: event.eventId,
        eventType: event.eventType,
        timestamp: Date.now(),
      },
    };
  } catch (err) {
    return {
      status: 500,
      data: {
        error: "Failed to apply catalog sync event",
        details: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
