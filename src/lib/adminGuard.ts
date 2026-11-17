import "server-only";
import { NextResponse } from "next/server";

/**
 * Defence in depth for /api/admin/*. The middleware already returns 404 in production; every handler
 * also calls this. REPLACE with real authentication (Supabase session + site_admins role) before enabling in production.
 * Also rejects cross-site requests (a browser page on another origin cannot drive the dev admin API).
 */
export function adminGuard(req: Request): NextResponse | null {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Cross-origin request refused" }, { status: 403 });
  return null;
}
