import "server-only";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import * as demo from "./auth/demoAccounts";
import * as supa from "./supabaseAdmin";
import { authMode } from "./auth/config";
import { adminAllowed } from "./adminGate";
import { sameOrigin } from "./http";

/**
 * Website-admin authentication. Admin is a SEPARATE session from customers and the role (owner / editor / viewer)
 * is decided on the server on every request, never from the browser.
 *  - Development: file-backed demo admin (.data), generated credentials.
 *  - Production: Supabase Auth shared with the ERP. An active ERP super admin is a website OWNER automatically
 *    (public.site_admin_role() in migration 102 calls the ERP's is_super_admin()); other admins come from site_admins.
 * The whole area stays 404 on a deployed site unless adminAllowed() is true (an explicit, deliberate switch).
 */
export type AdminRole = "viewer" | "editor" | "owner";
export interface Admin { userId: string; email: string; role: AdminRole }
const RANK: Record<AdminRole, number> = { viewer: 1, editor: 2, owner: 3 };
export const ADMIN_COOKIE = "mart_admin";

const dataDir = () => process.env.MART_DATA_DIR ?? path.join(process.cwd(), ".data");
const isSupabase = () => authMode() === "supabase";

/** First run in development: create an owner account with a random password and save it to a local, git-ignored file. */
export async function ensureDevAdmin(): Promise<void> {
  if (process.env.NODE_ENV === "production" || isSupabase()) return;
  const creds = await demo.ensureDevAdmin();
  if (!creds) return;
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(path.join(dataDir(), "dev-admin.json"), JSON.stringify(creds, null, 2));
  console.log(`[dev] Admin account created. Credentials saved to ${path.join(dataDir(), "dev-admin.json")}`);
}

export async function currentAdmin(): Promise<Admin | null> {
  if (!adminAllowed()) return null;
  if (isSupabase()) return supa.currentAdmin();
  if (process.env.NODE_ENV === "production") return null;        // the demo provider can never run in production
  return demo.sessionAdmin((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function adminLogin(email: string, password: string) {
  if (!adminAllowed()) return { ok: false as const, error: "Not available." };
  if (isSupabase()) return (await supa.login(email, password)) ? { ok: true as const } : { ok: false as const, error: "Incorrect email or password, or this account is not a website admin." };
  await ensureDevAdmin();
  const r = await demo.login(email, password, "admin");
  if (!r.ok) return { ok: false as const, error: "Incorrect email or password." };
  (await cookies()).set(ADMIN_COOKIE, r.sessionToken, { httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: demo.ADMIN_SESSION_TTL / 1000 });
  return { ok: true as const };
}

export async function adminLogout() {
  if (isSupabase()) return supa.logout();
  const c = await cookies(); demo.logout(c.get(ADMIN_COOKIE)?.value); c.delete({ name: ADMIN_COOKIE, path: "/" });
}

/** For admin PAGES: returns the signed-in admin or redirects to the login page. */
export async function requireAdminPage(min: AdminRole = "viewer"): Promise<Admin> {
  const a = await currentAdmin();
  if (!a) redirect("/admin/login");
  if (RANK[a.role] < RANK[min]) redirect("/admin?denied=1");
  return a;
}

/** For admin API routes: 404 unless the area is enabled, same-origin for writes, then a role check (401 / 403). */
export async function requireAdminApi(req: Request, min: AdminRole): Promise<{ admin: Admin } | { res: NextResponse }> {
  if (!adminAllowed()) return { res: new NextResponse("Not found", { status: 404 }) };
  const mutating = req.method !== "GET" && req.method !== "HEAD";
  if (mutating && !sameOrigin(req)) return { res: NextResponse.json({ error: "Cross-site request refused" }, { status: 403 }) };
  const admin = await currentAdmin();
  if (!admin) return { res: NextResponse.json({ error: "Admin sign-in required" }, { status: 401 }) };
  if (RANK[admin.role] < RANK[min]) return { res: NextResponse.json({ error: "Your role does not allow this action" }, { status: 403 }) };
  return { admin };
}
