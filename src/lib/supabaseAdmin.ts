import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Website-admin identity through Supabase Auth, shared with the ERP (same project, same logins).
 * The role is decided by the DATABASE, never the browser: public.site_admin_role() returns
 *   'owner'  for an active ERP super admin (via the ERP's own is_super_admin()),
 *   or the role stored in public.site_admins for other website admins (editor / viewer),
 *   or NULL for everyone else (including every website customer and every other ERP user).
 * STATUS: written to the documented API, NOT yet run against a live project, and unreachable in production
 * until the explicit switch in adminGate.ts is set.
 */
export type SbRole = "viewer" | "editor" | "owner";

async function client() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => { try { store.set({ name, value, ...options }); } catch { /* read-only context */ } },
      remove: (name: string, options: CookieOptions) => { try { store.set({ name, value: "", ...options, maxAge: 0 }); } catch { /* read-only context */ } },
    },
  });
}

async function roleOf(sb: Awaited<ReturnType<typeof client>>): Promise<SbRole | null> {
  const { data, error } = await sb.rpc("site_admin_role");
  if (error) return null;                                       // fail closed
  return data === "owner" || data === "editor" || data === "viewer" ? data : null;
}

export async function login(email: string, password: string): Promise<boolean> {
  const sb = await client();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user?.email_confirmed_at) { await sb.auth.signOut(); return false; }
  if (!(await roleOf(sb))) { await sb.auth.signOut(); return false; }   // valid ERP/website user but NOT an admin: no session is kept
  return true;
}

export async function logout() { await (await client()).auth.signOut(); }

export async function currentAdmin(): Promise<{ userId: string; email: string; role: SbRole } | null> {
  const sb = await client();
  const { data: { user } } = await sb.auth.getUser();           // validated by Supabase, not just decoded
  if (!user?.email) return null;
  const role = await roleOf(sb);
  return role ? { userId: user.id, email: user.email, role } : null;
}
