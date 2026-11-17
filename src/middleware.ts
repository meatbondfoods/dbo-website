import { NextResponse, type NextRequest } from "next/server";

/**
 * SAFETY GATE. The admin panel has no real authentication yet, so it must not be reachable on any
 * deployed site. In production (including Vercel preview deployments) /admin and /api/admin answer 404,
 * as if they did not exist. They are available only on a local `next dev` server.
 *
 * This gate must be replaced by real Supabase authentication plus a site_admins role check
 * (migration 102) before /admin is ever enabled in production.
 */
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"] };
