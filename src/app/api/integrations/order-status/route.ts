import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { verifyHmacSignature } from "@/lib/server-hmac";
import { loadSigningKeys, SyncConfigError } from "@/lib/sync-config";

export const dynamic = "force-dynamic";

const statusPayloadSchema = z.object({
  orderRef: z.string().min(1),
  status: z.enum([
    "pending_confirmation",
    "accepted",
    "confirmed",
    "processing",
    "ready",
    "dispatched",
    "delivered",
    "on_hold",
    "rejected",
    "cancelled",
  ]),
  salesOrderId: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  timestamp: z.string().optional(),
});

export async function POST(req: Request) {
  let keys;
  try {
    keys = loadSigningKeys();
  } catch (err) {
    console.error("[order-status] secret misconfigured:", err instanceof SyncConfigError ? err.message : err);
    return Response.json({ error: "Integration is not configured" }, { status: 503 });
  }

  const signature = req.headers.get("x-meatbond-signature");
  const timestamp = req.headers.get("x-meatbond-timestamp");
  const keyId = req.headers.get("x-meatbond-key-id");

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  // Verify HMAC signature across candidate keys
  const candidates = keyId ? keys.filter((k) => k.keyId === keyId) : keys;
  let verified = false;
  let authReason: string | undefined;

  for (const k of candidates) {
    const res = verifyHmacSignature(rawBody, k.secret, timestamp, signature);
    if (res.valid) {
      verified = true;
      break;
    }
    authReason = res.reason;
  }

  if (!verified) {
    return Response.json(
      { error: `Unauthorized webhook: ${authReason || "Invalid signature"}` },
      { status: 401 },
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Malformed JSON" }, { status: 400 });
  }

  // Support both raw status payload and envelope wrapped payload
  const candidatePayload =
    json && typeof json === "object" && "payload" in json
      ? (json as Record<string, unknown>).payload
      : json;

  const parsed = statusPayloadSchema.safeParse(candidatePayload);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid order status payload", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { orderRef, status, salesOrderId, reason } = parsed.data;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && serviceKey) {
    try {
      const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (salesOrderId) updateData.erp_sales_order_id = salesOrderId;
      if (reason) updateData.rejection_reason = reason;

      const { error } = await db.from("web_orders").update(updateData).eq("order_ref", orderRef);
      if (error) {
        console.warn("[order-status] web_orders update error:", error.message);
      }
    } catch (err) {
      console.warn("[order-status] database update exception:", err);
    }
  }

  return Response.json({ ok: true, orderRef, status, updated: true });
}
