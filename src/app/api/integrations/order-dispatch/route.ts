import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PgDispatchStore, runDispatchOnce } from "@/lib/order-dispatch";

// Retries queued orders to the ERP. Called by a scheduler (Vercel Cron sends
// `Authorization: Bearer $CRON_SECRET`). Fails closed: without a CRON_SECRET nobody can run it.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) return false;
  const a = crypto.createHash("sha256").update(req.headers.get("authorization") ?? "").digest();
  const b = crypto.createHash("sha256").update(`Bearer ${secret}`).digest();
  return crypto.timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.trim().length < 32) {
    console.error("[order-dispatch] CRON_SECRET is missing or shorter than 32 characters");
    return Response.json({ error: "Worker is not configured" }, { status: 503 });
  }
  if (!authorised(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "Worker is not configured" }, { status: 503 });
  if (url.includes("baifeezugzfkomjnmfgq")) return Response.json({ error: "Worker is misconfigured" }, { status: 503 });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const result = await runDispatchOnce({ store: new PgDispatchStore(db), workerId: `vercel-${crypto.randomUUID().slice(0, 8)}`, batchSize: 20 });
    // Orders that need a person: the ERP refused them.
    const stats = await db.rpc("order_dispatch_stats");
    return Response.json({ ok: true, ...result, queue: stats.data ?? null });
  } catch (err) {
    console.error("[order-dispatch] run failed:", err instanceof Error ? err.message : err);
    return Response.json({ error: "Worker run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
