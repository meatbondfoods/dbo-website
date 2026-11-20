import "server-only";
import { cookies } from "next/headers";
import { authMode } from "./config";
import * as demo from "./demoAccounts";
import * as store from "./demoStore";
import * as supa from "./supabaseAccounts";
import type { AccountUser, AddressDto, Err, Ok } from "./types";
import type { AddressInput, ProfileInput } from "./schemas";

/**
 * The single entry point the pages and routes use for accounts. It dispatches to the active provider
 * (see config.ts) so the UI never depends on which one is running.
 */
const COOKIE = "mart_session";
const cookieOpts = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge });
const devLink = (path: string, token?: string) => (token && authMode() === "demo" ? { devLink: `${path}?token=${token}` } : {});

export const accountsEnabled = () => authMode() !== "off";

export async function currentCustomer(): Promise<AccountUser | null> {
  const mode = authMode();
  if (mode === "demo") return demo.sessionCustomer((await cookies()).get(COOKIE)?.value);
  if (mode === "supabase") return supa.currentCustomer();
  return null;
}

type Reg = { fullName: string; email: string; password: string; phone: string };
export async function register(i: Reg): Promise<Ok<{ devLink?: string }> | Err> {
  const mode = authMode();
  if (mode === "supabase") return supa.register(i);
  if (mode !== "demo") return { ok: false, error: "Accounts are not available yet." };
  const r = await demo.register(i);
  return r.ok ? { ok: true, ...devLink("/verify-email", r.devToken) } : r;
}

export async function login(email: string, password: string): Promise<Ok | Err> {
  const mode = authMode();
  if (mode === "supabase") return supa.login(email, password);
  if (mode !== "demo") return { ok: false, error: "Accounts are not available yet." };
  const r = await demo.login(email, password);
  if (!r.ok) return r;
  (await cookies()).set(COOKIE, r.sessionToken, cookieOpts(demo.SESSION_TTL / 1000));
  return { ok: true };
}

export async function logout() {
  const mode = authMode();
  if (mode === "supabase") return supa.logout();
  if (mode === "demo") { const c = await cookies(); demo.logout(c.get(COOKIE)?.value); c.delete(COOKIE); }
}

export async function verifyEmail(token: string): Promise<Ok | Err> {
  return authMode() === "demo" ? demo.verifyEmail(token) : { ok: false, error: "This verification link is invalid or has expired." };
}
export async function resendVerification(email: string): Promise<{ devLink?: string }> {
  return authMode() === "demo" ? devLink("/verify-email", demo.resendVerification(email).devToken) : {};
}
export async function forgot(email: string): Promise<{ devLink?: string }> {
  const mode = authMode();
  if (mode === "supabase") { await supa.forgot(email); return {}; }
  return mode === "demo" ? devLink("/reset-password", demo.requestReset(email).devToken) : {};
}
export async function resetPassword(token: string, password: string): Promise<Ok | Err> {
  const mode = authMode();
  if (mode === "supabase") return supa.resetPassword(password);
  return mode === "demo" ? demo.resetPassword(token, password) : { ok: false, error: "Accounts are not available yet." };
}

export async function getOAuthUrl(provider: "facebook", next = "/account", origin?: string | null): Promise<{ url?: string; error?: string }> {
  const mode = authMode();
  if (mode === "supabase") {
    const url = await supa.getOAuthUrl(provider, next, origin);
    return url ? { url } : { error: "Could not initialize Facebook login." };
  }
  if (mode === "demo") {
    return { url: `/api/auth/oauth?provider=${provider}&next=${encodeURIComponent(next)}` };
  }
  return { error: "Accounts are not available yet." };
}

// ---- profile + addresses (the customerId always comes from the verified session, never from the request) ----
export async function updateProfile(u: AccountUser, p: ProfileInput): Promise<boolean> {
  if (authMode() === "supabase") return supa.updateProfile(u.customerId, p);
  return !!store.updateCustomer(u.customerId, { fullName: p.fullName, phone: p.phone });
}
const dto = (a: store.AddressRec): AddressDto => ({ id: a.id, fullName: a.fullName, phone: a.phone, line1: a.line1, area: a.area, city: a.city, postalCode: a.postalCode, instructions: a.instructions, isDefault: a.isDefault });
const mode = () => authMode();

export async function listAddresses(u: AccountUser): Promise<AddressDto[]> { return mode() === "supabase" ? supa.listAddresses(u.customerId) : store.listAddresses(u.customerId).map(dto); }
export async function createAddress(u: AccountUser, a: AddressInput): Promise<AddressDto | null> { if (mode() === "supabase") return supa.createAddress(u.customerId, a); const r = store.createAddress(u.customerId, a); return r ? dto(r) : null; }
export async function updateAddress(u: AccountUser, id: string, a: AddressInput): Promise<AddressDto | null> { if (mode() === "supabase") return supa.updateAddress(u.customerId, id, a); const r = store.updateAddress(u.customerId, id, a); return r ? dto(r) : null; }
export async function deleteAddress(u: AccountUser, id: string): Promise<boolean> { return mode() === "supabase" ? supa.deleteAddress(u.customerId, id) : store.deleteAddress(u.customerId, id); }
export async function setDefaultAddress(u: AccountUser, id: string): Promise<boolean> { return mode() === "supabase" ? supa.setDefaultAddress(u.customerId, id) : store.setDefaultAddress(u.customerId, id); }
