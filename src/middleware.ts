import { NextResponse, type NextRequest } from "next/server";
import { adminAllowed } from "./lib/adminGate";

/**
 * SAFETY GATE. /admin and /api/admin answer 404, as if they did not exist, on every deployed site
 * (including Vercel previews) unless adminAllowed() is true: that needs the deliberate switch MART_ADMIN=enabled
 * AND real Supabase authentication (MART_AUTH=supabase + keys). On a local `next dev` server it is always open
 * (demo admin). Inside the area, every page and API call still requires a signed-in admin with a server-side role.
 */
export function middleware(req: NextRequest) {
  if (!adminAllowed()) {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"] };
