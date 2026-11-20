import { NextResponse } from "next/server";
import { authMode, resolveSiteUrl } from "@/lib/auth/config";
import { getOAuthUrl } from "@/lib/auth/service";
import { cookies } from "next/headers";
import * as demo from "@/lib/auth/demoAccounts";

function getRequestOrigin(req: Request): string {
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return resolveSiteUrl(`${proto}://${host}`);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const next = url.searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const origin = getRequestOrigin(req);

  if (provider !== "facebook" && provider !== "google") {
    return NextResponse.redirect(new URL("/login?error=invalid_provider", origin));
  }

  const mode = authMode();

  if (mode === "demo") {
    // In local development demo mode, simulate OAuth sign in
    const email = provider === "google" ? "demo.google.customer@example.com" : "demo.facebook.customer@example.com";
    const name = provider === "google" ? "Google Customer" : "Facebook Customer";
    const r = demo.demoOAuthLogin(email, name);
    const cookieStore = await cookies();
    cookieStore.set("mart_session", r.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: demo.SESSION_TTL / 1000,
    });
    return NextResponse.redirect(new URL(safeNext, origin));
  }

  if (mode === "supabase") {
    const oauth = await getOAuthUrl(provider, safeNext, origin);
    if (oauth.url) {
      return NextResponse.redirect(oauth.url);
    }
    return NextResponse.redirect(new URL("/login?error=oauth_init_failed", origin));
  }

  return NextResponse.redirect(new URL("/login?error=auth_off", origin));
}
