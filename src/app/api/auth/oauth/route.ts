import { NextResponse } from "next/server";
import { authMode } from "@/lib/auth/config";
import { getOAuthUrl } from "@/lib/auth/service";
import { cookies } from "next/headers";
import * as demo from "@/lib/auth/demoAccounts";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const next = url.searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  if (provider !== "facebook") {
    return NextResponse.redirect(new URL("/login?error=invalid_provider", url.origin));
  }

  const mode = authMode();

  if (mode === "demo") {
    // In local development demo mode, simulate Facebook OAuth sign in
    const r = demo.demoOAuthLogin("demo.facebook.customer@example.com", "Facebook Customer");
    const cookieStore = await cookies();
    cookieStore.set("mart_session", r.sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: demo.SESSION_TTL / 1000,
    });
    return NextResponse.redirect(new URL(safeNext, url.origin));
  }

  if (mode === "supabase") {
    const oauth = await getOAuthUrl("facebook", safeNext);
    if (oauth.url) {
      return NextResponse.redirect(oauth.url);
    }
    return NextResponse.redirect(new URL("/login?error=oauth_init_failed", url.origin));
  }

  return NextResponse.redirect(new URL("/login?error=auth_off", url.origin));
}
