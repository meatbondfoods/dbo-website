import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { processCatalogSyncEvent, type CatalogApplier } from "@/lib/catalog-sync-service";
import { loadSigningKeys, SyncConfigError } from "@/lib/sync-config";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Fail closed: no secret, or no server-side database access, means nothing can be accepted.
  let keys;
  try {
    keys = loadSigningKeys();
  } catch (err) {
    console.error("[catalog-sync] secret misconfigured:", err instanceof SyncConfigError ? err.message : err);
    return Response.json({ error: "Integration is not configured" }, { status: 503 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("[catalog-sync] server database access is not configured");
    return Response.json({ error: "Integration is not configured" }, { status: 503 });
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const result = await processCatalogSyncEvent(
    rawBody,
    {
      signature: req.headers.get("x-meatbond-signature"),
      timestamp: req.headers.get("x-meatbond-timestamp"),
      keyId: req.headers.get("x-meatbond-key-id"),
    },
    { keys, db: db as unknown as CatalogApplier },
  );

  if (result.changed) {
    try {
      revalidatePath("/shop");
      revalidatePath("/");
      revalidatePath("/product/[slug]", "page");
    } catch (err) {
      console.warn("[catalog-sync] revalidate failed:", err instanceof Error ? err.message : err);
    }
  }
  return Response.json(result.data, { status: result.status });
}
