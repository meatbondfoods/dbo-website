import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { AccountUser, AddressDto, Err, Ok } from "./types";
import type { AddressInput, ProfileInput } from "./schemas";
import { resolveSiteUrl } from "./config";

/**
 * Supabase Auth provider (email + password, email verification, password reset).
 * STATUS: written to the documented Supabase API but NOT YET RUN against a live project. It is inactive until
 * MART_AUTH=supabase is configured (see config.ts), which needs the owner's approval of the Supabase settings:
 *   - Auth > Providers > Email: enabled, "Confirm email" ON (so unverified users cannot sign in)
 *   - Auth > URL configuration: Site URL + redirect URL  <SITE_URL>/auth/callback
 *   - Migrations 101/105 applied to the development project first.
 * Passwords are handled by Supabase Auth only; this site never sees or stores them.
 */
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
const site = (origin?: string | null) => resolveSiteUrl(origin);
const generic = "Check your email for a verification link.";

export async function register(i: { fullName: string; email: string; password: string; phone: string }): Promise<Ok<{ message: string }> | Err> {
  const sb = await client();
  const { error } = await sb.auth.signUp({ email: i.email, password: i.password, options: { emailRedirectTo: `${site()}/auth/callback?next=/login`, data: { full_name: i.fullName, phone: i.phone } } });
  if (error && /password/i.test(error.message)) return { ok: false, error: error.message };
  return { ok: true, message: generic };            // identical response whether or not the email already exists
}

export async function login(email: string, password: string): Promise<Ok | Err> {
  const sb = await client();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return /confirm/i.test(error.message) ? { ok: false, code: "unverified", error: "Please verify your email address first. Check your inbox for the link." } : { ok: false, code: "invalid", error: "Incorrect email or password." };
  if (!data.user?.email_confirmed_at) { await sb.auth.signOut(); return { ok: false, code: "unverified", error: "Please verify your email address first." }; }
  return { ok: true };
}

export async function logout() { await (await client()).auth.signOut(); }

export async function forgot(email: string) { await (await client()).auth.resetPasswordForEmail(email, { redirectTo: `${site()}/auth/callback?next=/reset-password` }); }

/** Called from /reset-password after the recovery link has established a short-lived session. */
export async function resetPassword(password: string): Promise<Ok | Err> {
  const { error } = await (await client()).auth.updateUser({ password });
  return error ? { ok: false, error: "This reset link is invalid or has expired." } : { ok: true };
}

export async function exchangeCode(code: string): Promise<boolean> {
  const { error } = await (await client()).auth.exchangeCodeForSession(code);
  return !error;
}

export async function getOAuthUrl(provider: "facebook" | "google", next = "/account", origin?: string | null): Promise<string | null> {
  const sb = await client();
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  const baseUrl = resolveSiteUrl(origin);
  const redirectTo = `${baseUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      scopes: provider === "facebook" ? "email,public_profile" : "email,profile",
      queryParams: provider === "google" ? { access_type: "offline", prompt: "select_account" } : undefined,
    },
  });
  if (error || !data.url) return null;
  return data.url;
}

/** getUser() asks Supabase to validate the JWT; the role/ownership is enforced again by RLS in the database. */
export async function currentCustomer(): Promise<AccountUser | null> {
  const sb = await client();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const isConfirmed = !!(user.email_confirmed_at || user.confirmed_at || (user.app_metadata?.provider && user.app_metadata.provider !== "email"));
  if (!isConfirmed) return null;
  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string; phone?: string };
  const name = meta.full_name || meta.name || "Customer";
  // register_web_customer() is idempotent and issues the permanent MBM-CUS id from a database sequence.
  const { data, error } = await sb.rpc("register_web_customer", { p_full_name: name, p_phone: meta.phone ?? "" });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return { customerId: row.customer_id, customerCode: row.customer_code, email: user.email ?? "", fullName: row.full_name, phone: row.phone ?? "" };
}

export async function updateProfile(customerId: string, p: ProfileInput) {
  const { error } = await (await client()).from("web_customers").update({ full_name: p.fullName, phone: p.phone || null }).eq("id", customerId);
  return !error;
}

const toDto = (r: Record<string, unknown>): AddressDto => ({ id: r.id as string, fullName: r.full_name as string, phone: r.phone as string, line1: r.line1 as string, area: r.area as string, city: r.city as string, postalCode: (r.postal_code as string) ?? "", instructions: (r.instructions as string) ?? "", isDefault: !!r.is_default });
const toRow = (a: AddressInput) => ({ full_name: a.fullName, phone: a.phone, line1: a.line1, area: a.area, city: a.city, postal_code: a.postalCode, instructions: a.instructions, is_default: a.isDefault });

// Ownership is enforced by RLS (web_customer_id must belong to auth.uid()), in addition to the id filters here.
export async function listAddresses(customerId: string) { const { data } = await (await client()).from("web_customer_addresses").select("*").eq("web_customer_id", customerId).order("created_at"); return (data ?? []).map(toDto); }
export async function createAddress(customerId: string, a: AddressInput) { const { data, error } = await (await client()).from("web_customer_addresses").insert({ ...toRow(a), web_customer_id: customerId }).select().single(); return error ? null : toDto(data); }
export async function updateAddress(customerId: string, id: string, a: AddressInput) { const { data, error } = await (await client()).from("web_customer_addresses").update(toRow(a)).eq("id", id).eq("web_customer_id", customerId).select().single(); return error ? null : toDto(data); }
export async function deleteAddress(customerId: string, id: string) { const { error } = await (await client()).from("web_customer_addresses").delete().eq("id", id).eq("web_customer_id", customerId); return !error; }
export async function setDefaultAddress(customerId: string, id: string) { const { error } = await (await client()).from("web_customer_addresses").update({ is_default: true }).eq("id", id).eq("web_customer_id", customerId); return !error; }
