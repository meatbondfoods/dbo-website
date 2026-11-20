import { NextResponse } from "next/server";
import { authMode, resolveSiteUrl } from "@/lib/auth/config";
import { exchangeCode } from "@/lib/auth/supabaseAccounts";

function getRequestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return resolveSiteUrl(`${proto}://${host}`);
}

// Supabase email links (verification and password recovery) and OAuth callbacks land here with a one-time ?code=.
// Inactive unless Supabase auth mode is configured.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";     // no open redirects
  const origin = getRequestOrigin(req);

  if (authMode() !== "supabase") return NextResponse.redirect(new URL("/login", origin));
  const code = url.searchParams.get("code");
  const ok = code ? await exchangeCode(code) : false;
  return NextResponse.redirect(new URL(ok ? safeNext : "/login?error=link", origin));
}
