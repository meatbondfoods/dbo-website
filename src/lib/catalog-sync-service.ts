import crypto from "node:crypto";
import { z } from "zod";
import { verifyHmacSignature } from "./server-hmac.ts";
import type { SigningKey } from "./sync-config.ts";

/**
 * Receiver for signed ERP catalog events (contract v1, produced by the ERP's sync worker).
 *
 * Order of checks, each fail-closed:
 *   1. HMAC signature over `timestamp.rawBody`, 5-minute replay window, key-id routing
 *   2. envelope and payload schema
 *   3. the database applies the event atomically (apply_catalog_event): idempotency by event id,
 *      conflict on the same id with a different body, stale versions ignored, content and stock
 *      guarded by separate versions.
 * No state is kept in memory: the projection and the applied-event ledger live in the database.
 */

const availability = z.enum(["in_stock", "low_stock", "out_of_stock"]);

const variantSchema = z
  .object({
    id: z.string().min(1),
    sku: z.string().min(1),
    label: z.string().min(1),
    variantType: z.enum(["weight", "piece", "pack", "custom"]),
    grams: z.number().int().nonnegative(),
    pieces: z.number().int().positive().optional(),
    uomFactor: z.number().positive(),
    price: z.number().positive(),
    compareAtPrice: z.number().positive().optional(),
    isAvailable: z.boolean(),
  })
  .refine((v) => v.compareAtPrice === undefined || v.compareAtPrice > v.price, { message: "compareAtPrice must exceed price" });

const productSchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  categoryId: z.string().min(1),
  categoryName: z.string().optional(),
  description: z.string(),
  storageInstructions: z.string().optional(),
  images: z.array(z.string()),
  variants: z.array(variantSchema).min(1),
  availability,
  tags: z.array(z.string()),
  badge: z.string().optional(),
  sortOrder: z.number().int(),
  isPublished: z.literal(true),
});

const base = {
  eventId: z.string().min(16).max(100),
  schemaVersion: z.literal(1),
  aggregateId: z.string().min(1),
  aggregateVersion: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
};

export const eventSchema = z.discriminatedUnion("eventType", [
  z.object({ ...base, eventType: z.literal("catalog.product.upsert"), payload: productSchema }),
  z.object({
    ...base,
    eventType: z.literal("catalog.product.unpublish"),
    payload: z.object({ productId: z.string().min(1), reason: z.enum(["unpublished", "inactive", "no_priced_variant", "no_publication"]) }),
  }),
  z.object({
    ...base,
    eventType: z.literal("catalog.stock.update"),
    payload: z.object({
      productId: z.string().min(1),
      availability,
      variants: z.array(z.object({ id: z.string().min(1), isAvailable: z.boolean() })).optional(),
    }),
  }),
]);

export type CatalogSyncEvent = z.infer<typeof eventSchema>;

/** The database call that applies an event. A Supabase service client satisfies it. */
export interface CatalogApplier {
  rpc(fn: "apply_catalog_event", args: { p_event: unknown; p_body_hash: string }): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export interface SyncHeaders {
  signature?: string | null;
  timestamp?: string | null;
  keyId?: string | null;
}

export interface SyncProcessResult {
  status: number;
  /** True only when this call changed the projection (the route then revalidates caches). */
  changed: boolean;
  data: Record<string, unknown>;
}

function verify(rawBody: string, headers: SyncHeaders, keys: SigningKey[]): { valid: boolean; reason?: string } {
  const candidates = headers.keyId ? keys.filter((k) => k.keyId === headers.keyId) : keys;
  if (candidates.length === 0) return { valid: false, reason: "Unknown key id" };
  let last: string | undefined;
  for (const k of candidates) {
    const r = verifyHmacSignature(rawBody, k.secret, headers.timestamp ?? null, headers.signature ?? null);
    if (r.valid) return r;
    last = r.reason;
  }
  return { valid: false, reason: last };
}

export async function processCatalogSyncEvent(
  rawBody: string,
  headers: SyncHeaders,
  deps: { keys: SigningKey[]; db: CatalogApplier },
): Promise<SyncProcessResult> {
  const auth = verify(rawBody, headers, deps.keys);
  if (!auth.valid) return { status: 401, changed: false, data: { error: `Unauthorized: ${auth.reason || "Invalid signature"}` } };

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { status: 400, changed: false, data: { error: "Malformed JSON" } };
  }
  const parsed = eventSchema.safeParse(json);
  if (!parsed.success) return { status: 422, changed: false, data: { error: "Invalid sync event", details: parsed.error.flatten() } };
  const event = parsed.data;

  // The aggregate id in the envelope must match the payload's product, or one signed event could
  // be used to write another product's guards.
  const payloadId = event.eventType === "catalog.product.upsert" ? event.payload.id : event.payload.productId;
  if (payloadId !== event.aggregateId) {
    return { status: 422, changed: false, data: { error: "aggregateId does not match the payload product" } };
  }

  // Hash of the exact bytes received: a retry is byte-identical, a tampered replay is not.
  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  const { data, error } = await deps.db.rpc("apply_catalog_event", { p_event: json, p_body_hash: bodyHash });
  if (error) {
    console.error("[catalog-sync] apply_catalog_event failed:", error.message);
    return { status: 500, changed: false, data: { error: "Could not apply event" } };
  }

  const verdict = (data as { status?: string } | null)?.status;
  switch (verdict) {
    case "applied":
      return { status: 200, changed: true, data: { success: true, status: "applied", eventId: event.eventId } };
    case "stale":
      // Acknowledged so the ERP stops retrying: a newer version is already applied.
      return { status: 200, changed: false, data: { success: true, status: "stale", eventId: event.eventId } };
    case "duplicate":
      return { status: 200, changed: false, data: { success: true, status: "duplicate", eventId: event.eventId } };
    case "conflict":
      return { status: 409, changed: false, data: { error: "Event id already used with a different body" } };
    case "invalid":
      return { status: 422, changed: false, data: { error: "Event rejected", reason: (data as { reason?: string }).reason } };
    default:
      return { status: 500, changed: false, data: { error: "Unrecognised result from the database" } };
  }
}
