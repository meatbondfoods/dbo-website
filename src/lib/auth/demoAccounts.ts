// Account logic for the DEVELOPMENT provider (see config.ts). Pure: takes explicit inputs and returns results;
// cookie handling lives in the route handlers. Mirrors what Supabase Auth does in production:
// register -> email verification required -> login -> session; reset by one-time token; lockout after repeated failures.
import { hashPassword, validatePassword, verifyPassword } from "./password.ts";
import * as store from "./demoStore.ts";

const HOUR = 3_600_000, DAY = 24 * HOUR;
const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;
export const SESSION_TTL = 14 * DAY, ADMIN_SESSION_TTL = 8 * HOUR;

export interface AccountUser { customerId: string; customerCode: string; email: string; fullName: string; phone: string }
type Fail<C extends string = string> = { ok: false; error: string; code?: C };

// A dummy hash so unknown emails cost the same time as real ones (no account enumeration by timing).
let dummy: Promise<string> | null = null;
const dummyHash = () => (dummy ??= hashPassword("not-a-real-password-0"));

export async function register(input: { fullName: string; email: string; password: string; phone: string }): Promise<{ ok: true; devToken?: string } | Fail> {
  const pwErr = validatePassword(input.password);
  if (pwErr) return { ok: false, error: pwErr };
  const existing = store.findUserByEmail(input.email);
  if (existing) {
    // Never reveal whether an email is registered. An unverified account gets a fresh verification token.
    if (!existing.verifiedAt) { store.updateUser(existing.id, { pendingName: input.fullName, pendingPhone: input.phone }); return { ok: true, devToken: store.createToken(existing.id, "verify", DAY) }; }
    return { ok: true };
  }
  // The customer record (and its permanent ID) is created at email verification; sign-up details wait on the user record.
  const user = store.createUser(input.email, await hashPassword(input.password), { name: input.fullName, phone: input.phone });
  if (!user) return { ok: true };
  return { ok: true, devToken: store.createToken(user.id, "verify", DAY) };
}

export function verifyEmail(token: string): { ok: true } | Fail {
  const userId = store.consumeToken(token, "verify");
  if (!userId) return { ok: false, error: "This verification link is invalid or has expired." };
  store.updateUser(userId, { verifiedAt: new Date().toISOString() });
  const u = store.findUserById(userId);
  store.ensureCustomer(userId, u?.pendingName ?? "Customer", u?.pendingPhone ?? "");   // issues the permanent MBM-CUS id (once)
  store.updateUser(userId, { pendingName: undefined, pendingPhone: undefined });
  return { ok: true };
}

export function resendVerification(email: string): { devToken?: string } {
  const u = store.findUserByEmail(email);
  return u && !u.verifiedAt ? { devToken: store.createToken(u.id, "verify", DAY) } : {};
}

export async function login(email: string, password: string, scope: "customer" | "admin" = "customer"): Promise<{ ok: true; sessionToken: string } | Fail<"invalid" | "unverified" | "locked">> {
  const bad: Fail<"invalid"> = { ok: false, error: "Incorrect email or password.", code: "invalid" };
  const u = store.findUserByEmail(email);
  if (!u) { await verifyPassword(password, await dummyHash()); return bad; }
  if (u.lockedUntil > Date.now()) return { ok: false, error: "Too many failed attempts. Try again in a few minutes.", code: "locked" };
  if (!(await verifyPassword(password, u.passwordHash))) {
    const failed = u.failed + 1;
    store.updateUser(u.id, failed >= MAX_FAILS ? { failed: 0, lockedUntil: Date.now() + LOCK_MS } : { failed });
    return bad;
  }
  if (!u.verifiedAt) return { ok: false, error: "Please verify your email address first. Check your inbox for the link.", code: "unverified" };
  if (scope === "admin" && !store.getAdminRole(u.id)) return bad;           // admin scope requires a server-side admin record
  store.updateUser(u.id, { failed: 0, lockedUntil: 0 });
  return { ok: true, sessionToken: store.createSession(u.id, scope, scope === "admin" ? ADMIN_SESSION_TTL : SESSION_TTL) };
}

export const logout = (token: string | undefined) => store.deleteSession(token);

export function sessionCustomer(token: string | undefined): AccountUser | null {
  const u = store.getSessionUser(token, "customer"); if (!u) return null;
  const c = store.getCustomerByUser(u.id); if (!c) return null;
  return { customerId: c.id, customerCode: c.customerCode, email: u.email, fullName: c.fullName, phone: c.phone };
}

export function sessionAdmin(token: string | undefined): { userId: string; email: string; role: "owner" | "editor" | "viewer" } | null {
  const u = store.getSessionUser(token, "admin"); if (!u) return null;
  const role = store.getAdminRole(u.id);                                     // role comes from the server-side store only
  return role ? { userId: u.id, email: u.email, role } : null;
}

export function requestReset(email: string): { devToken?: string } {
  const u = store.findUserByEmail(email);
  return u && u.verifiedAt ? { devToken: store.createToken(u.id, "reset", HOUR) } : {};   // same response shape either way
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true } | Fail> {
  const pwErr = validatePassword(password); if (pwErr) return { ok: false, error: pwErr };
  const userId = store.consumeToken(token, "reset");
  if (!userId) return { ok: false, error: "This reset link is invalid or has expired." };
  store.updateUser(userId, { passwordHash: await hashPassword(password), failed: 0, lockedUntil: 0 });
  store.deleteSessionsFor(userId);                                           // a reset signs the account out everywhere
  return { ok: true };
}

/** Creates the development admin account once and returns its generated credentials (written to a local file by the caller). */
export async function ensureDevAdmin(email = "admin@mart.local"): Promise<{ email: string; password: string } | null> {
  const existing = store.findUserByEmail(email);
  if (existing) return null;
  const password = `Dev-${store.newToken().slice(0, 14)}9`;
  const user = store.createUser(email, await hashPassword(password))!;
  store.updateUser(user.id, { verifiedAt: new Date().toISOString() });
  store.setAdmin(user.id, "owner");
  return { email, password };
}

/** Simulates third-party social OAuth sign-in (e.g. Facebook) in the local dev environment. */
export function demoOAuthLogin(email = "demo.facebook.customer@example.com", name = "Facebook Customer"): { ok: true; sessionToken: string } {
  let user = store.findUserByEmail(email);
  if (!user) {
    user = store.createUser(email, "social-auth-no-password", { name, phone: "" })!;
  }
  if (!user.verifiedAt) {
    store.updateUser(user.id, { verifiedAt: new Date().toISOString() });
    store.ensureCustomer(user.id, name, "");
  }
  const sessionToken = store.createSession(user.id, "customer", SESSION_TTL);
  return { ok: true, sessionToken };
}
