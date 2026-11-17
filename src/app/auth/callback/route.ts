import { NextResponse } from "next/server";
import { authMode } from "@/lib/auth/config";
import { exchangeCode } from "@/lib/auth/supabaseAccounts";

// Supabase email links (verification and password recovery) land here with a one-time ?code=.
// Inactive unless Supabase auth mode is configured.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/login";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/login";     // no open redirects
  if (authMode() !== "supabase") return NextResponse.redirect(new URL("/login", url.origin));
  const code = url.searchParams.get("code");
  const ok = code ? await exchangeCode(code) : false;
  return NextResponse.redirect(new URL(ok ? safeNext : "/login?error=link", url.origin));
}
