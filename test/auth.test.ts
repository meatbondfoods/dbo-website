import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hashPassword, validatePassword, verifyPassword } from "../src/lib/auth/password.ts";
import { addressSchema, loginSchema, profileSchema, registerSchema } from "../src/lib/auth/schemas.ts";
import * as A from "../src/lib/auth/demoAccounts.ts";
import * as S from "../src/lib/auth/demoStore.ts";

let dir = "";
before(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "mart-auth-")); process.env.MART_DATA_DIR = dir; });
after(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const GOOD = "Sturdy-Pass-42";
async function signUp(email: string, name = "Test Customer") {
  const r = await A.register({ fullName: name, email, password: GOOD, phone: "" });
  assert.ok(r.ok && r.devToken, "registration returns a dev token");
  assert.deepEqual(A.verifyEmail(r.devToken!), { ok: true });
}

test("passwords are hashed with a per-user salt, never stored in plain text", async () => {
  const h1 = await hashPassword(GOOD), h2 = await hashPassword(GOOD);
  assert.ok(h1.startsWith("scrypt$") && !h1.includes(GOOD));
  assert.notEqual(h1, h2);                                   // different salts
  assert.equal(await verifyPassword(GOOD, h1), true);
  assert.equal(await verifyPassword("wrong-password-1", h1), false);
  assert.equal(await verifyPassword(GOOD, "garbage"), false);
});

test("password policy", () => {
  assert.ok(validatePassword("short1"));
  assert.ok(validatePassword("alllettersnodigits"));
  assert.ok(validatePassword("1234567890"));
  assert.ok(validatePassword("Password123"));                // common
  assert.equal(validatePassword(GOOD), null);
});

test("input schemas normalise and reject bad data", () => {
  assert.equal(registerSchema.parse({ fullName: "A B", email: "  Foo@Example.COM ", password: GOOD }).email, "foo@example.com");
  assert.equal(registerSchema.parse({ fullName: "A B", email: "a@b.co", password: GOOD, phone: "01712-345678" }).phone, "+8801712345678");
  assert.equal(registerSchema.safeParse({ fullName: "A B", email: "nope", password: GOOD }).success, false);
  assert.equal(registerSchema.safeParse({ fullName: "A B", email: "a@b.co", password: GOOD, phone: "12345" }).success, false);
  assert.equal(profileSchema.safeParse({ fullName: "A", phone: "" }).success, false);
  assert.equal(loginSchema.safeParse({ email: "a@b.co", password: "" }).success, false);
  const addr = { fullName: "A B", phone: "01712345678", line1: "House 5 Road 3", area: "Gulshan", city: "Dhaka" };
  assert.equal(addressSchema.parse(addr).phone, "+8801712345678");
  assert.equal(addressSchema.safeParse({ ...addr, postalCode: "12" }).success, false);
  assert.equal(addressSchema.safeParse({ ...addr, line1: "x" }).success, false);
});

test("registration requires email verification before login", async () => {
  const r = await A.register({ fullName: "Ann Verify", email: "ann@example.com", password: GOOD, phone: "" });
  assert.ok(r.ok);
  const early = await A.login("ann@example.com", GOOD);
  assert.equal(early.ok, false); assert.equal((early as { code?: string }).code, "unverified");
  assert.deepEqual(A.verifyEmail("not-a-real-token-not-a-real-token"), { ok: false, error: "This verification link is invalid or has expired." });
  assert.deepEqual(A.verifyEmail((r as { devToken: string }).devToken), { ok: true });
  assert.equal(A.verifyEmail((r as { devToken: string }).devToken).ok, false);   // a token is single-use
  const ok = await A.login("ann@example.com", GOOD);
  assert.equal(ok.ok, true);
  const me = A.sessionCustomer((ok as { sessionToken: string }).sessionToken);
  assert.equal(me?.fullName, "Ann Verify");
  assert.match(me!.customerCode, /^MBM-CUS-\d{6}$/);
});

test("login does not reveal whether an email exists, and rejects wrong passwords", async () => {
  const a = await A.login("ghost@example.com", GOOD), b = await A.login("ann@example.com", "wrong-Pass-99");
  assert.deepEqual([a.ok, (a as { error: string }).error], [b.ok, (b as { error: string }).error]);
  const dup = await A.register({ fullName: "Ann Again", email: "ANN@example.com", password: GOOD, phone: "" });
  assert.deepEqual(dup, { ok: true });                       // same generic answer for an existing, verified email
});

test("customer IDs are unique, sequential, permanent and never reused", async () => {
  const emails = Array.from({ length: 12 }, (_, i) => `u${i}@example.com`);
  for (const e of emails) await signUp(e);
  const codes = emails.map((e) => S.getCustomerByUser(S.findUserByEmail(e)!.id)!.customerCode);
  assert.equal(new Set(codes).size, codes.length);
  const nums = codes.map((c) => Number(c.slice(-6)));
  assert.deepEqual(nums, [...nums].sort((x, y) => x - y));
  const before = S.getCustomerByUser(S.findUserByEmail("u3@example.com")!.id)!;
  S.updateCustomer(before.id, { fullName: "Renamed", phone: "" });
  const after = S.getCustomerByUser(S.findUserByEmail("u3@example.com")!.id)!;
  assert.equal(after.customerCode, before.customerCode);     // editing the profile never changes the ID
  assert.equal(S.ensureCustomer(before.userId, "x", "").customerCode, before.customerCode);   // idempotent
  const max = Math.max(...nums);
  await signUp("later@example.com");
  const later = S.getCustomerByUser(S.findUserByEmail("later@example.com")!.id)!;
  assert.ok(Number(later.customerCode.slice(-6)) > max);     // the counter only moves forward
});

test("password reset: single-use token, signs out every session, new password works", async () => {
  await signUp("reset@example.com");
  const s1 = await A.login("reset@example.com", GOOD);
  const tok = A.requestReset("reset@example.com").devToken!;
  assert.deepEqual(A.requestReset("nobody@example.com"), {});          // no token, same shape, no enumeration
  assert.equal((await A.resetPassword(tok, "short")).ok, false);       // weak password rejected (token not yet consumed? it is consumed only after policy passes)
  const r = await A.resetPassword(tok, "Brand-New-Pass-7");
  assert.equal(r.ok, true);
  assert.equal(A.sessionCustomer((s1 as { sessionToken: string }).sessionToken), null);   // old session is dead
  assert.equal((await A.resetPassword(tok, "Another-Pass-77")).ok, false);               // token cannot be reused
  assert.equal((await A.login("reset@example.com", GOOD)).ok, false);
  assert.equal((await A.login("reset@example.com", "Brand-New-Pass-7")).ok, true);
});

test("account lockout after repeated failures", async () => {
  await signUp("lock@example.com");
  for (let i = 0; i < 5; i++) await A.login("lock@example.com", "wrong-Pass-1");
  const locked = await A.login("lock@example.com", GOOD);                // even the right password is refused while locked
  assert.equal(locked.ok, false); assert.equal((locked as { code?: string }).code, "locked");
});

test("sessions: logout invalidates the token; a customer token never works as an admin token", async () => {
  await signUp("sess@example.com");
  const s = (await A.login("sess@example.com", GOOD)) as { sessionToken: string };
  assert.ok(A.sessionCustomer(s.sessionToken));
  assert.equal(A.sessionAdmin(s.sessionToken), null);                    // wrong scope
  A.logout(s.sessionToken);
  assert.equal(A.sessionCustomer(s.sessionToken), null);
  assert.equal((await A.login("sess@example.com", GOOD, "admin")).ok, false);   // no admin record -> cannot get an admin session
});

test("addresses: CRUD, default handling, limits, and strict per-customer isolation", async () => {
  await signUp("addr1@example.com"); await signUp("addr2@example.com");
  const c1 = S.getCustomerByUser(S.findUserByEmail("addr1@example.com")!.id)!, c2 = S.getCustomerByUser(S.findUserByEmail("addr2@example.com")!.id)!;
  const base = { fullName: "A B", phone: "+8801712345678", line1: "House 5 Road 3", area: "Gulshan", city: "Dhaka", postalCode: "1212", instructions: "", isDefault: false };
  const a1 = S.createAddress(c1.id, base)!, a2 = S.createAddress(c1.id, { ...base, line1: "Second house 9" })!;
  assert.equal(a1.isDefault, true);                                     // first address is the default
  assert.equal(a2.isDefault, false);
  assert.equal(S.setDefaultAddress(c1.id, a2.id), true);
  assert.deepEqual(S.listAddresses(c1.id).map((a) => [a.line1, a.isDefault]).sort(), [["House 5 Road 3", false], ["Second house 9", true]]);
  // isolation: customer 2 can neither see nor touch customer 1's addresses
  assert.equal(S.listAddresses(c2.id).length, 0);
  assert.equal(S.updateAddress(c2.id, a1.id, { ...base, line1: "Hijacked address" }), null);
  assert.equal(S.deleteAddress(c2.id, a1.id), false);
  assert.equal(S.setDefaultAddress(c2.id, a1.id), false);
  assert.equal(S.listAddresses(c1.id).find((a) => a.id === a1.id)?.line1, "House 5 Road 3");   // untouched
  // deleting the default promotes another
  assert.equal(S.deleteAddress(c1.id, a2.id), true);
  assert.equal(S.listAddresses(c1.id)[0].isDefault, true);
  for (let i = 0; i < 12; i++) S.createAddress(c1.id, { ...base, line1: `Extra address ${i}` });
  assert.equal(S.listAddresses(c1.id).length, 10);                      // capped
});

test("admin accounts: role comes from the server-side store and gates the admin scope", async () => {
  const creds = await A.ensureDevAdmin("boss@mart.test");
  assert.ok(creds && creds.password.length > 12);
  assert.equal(await A.ensureDevAdmin("boss@mart.test"), null);          // created once
  const s = await A.login(creds!.email, creds!.password, "admin");
  assert.equal(s.ok, true);
  assert.equal(A.sessionAdmin((s as { sessionToken: string }).sessionToken)?.role, "owner");
  assert.equal(A.sessionCustomer((s as { sessionToken: string }).sessionToken), null);   // admin session is not a customer session
});

test("social login: demo OAuth issues a verified session and customer ID", () => {
  const r = A.demoOAuthLogin("fb.user@example.com", "FB User");
  assert.equal(r.ok, true);
  const customer = A.sessionCustomer(r.sessionToken);
  assert.ok(customer);
  assert.equal(customer?.email, "fb.user@example.com");
  assert.equal(customer?.fullName, "FB User");
  assert.match(customer?.customerCode ?? "", /^MBM-CUS-\d{6}$/);
});

import { authMode } from "../src/lib/auth/config.ts";
test("auth mode: demo is impossible in production; Supabase needs explicit opt-in, not just keys", () => {
  const keep = { ...process.env };
  const set = (env: Record<string, string | undefined>) => { for (const k of ["NODE_ENV", "MART_AUTH", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) delete process.env[k]; Object.assign(process.env, env); return authMode(); };
  try {
    const keys = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };
    assert.equal(set({ NODE_ENV: "production" }), "off");                                   // today's live site
    assert.equal(set({ NODE_ENV: "production", ...keys }), "off");                          // keys alone do NOT enable auth
    assert.equal(set({ NODE_ENV: "production", MART_AUTH: "demo" }), "off");                // demo cannot be forced on in production
    assert.equal(set({ NODE_ENV: "production", MART_AUTH: "supabase" }), "off");            // opt-in without keys is still off
    assert.equal(set({ NODE_ENV: "production", MART_AUTH: "supabase", ...keys }), "supabase");
    assert.equal(set({ NODE_ENV: "development" }), "demo");
    assert.equal(set({ NODE_ENV: "development", MART_AUTH: "off" }), "off");
  } finally { for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k]; Object.assign(process.env, keep); }
});

import { adminAllowed } from "../src/lib/adminGate.ts";
test("admin gate: open in development; in production only with the deliberate switch AND real auth AND Supabase keys", () => {
  const keep = { ...process.env };
  const set = (env: Record<string, string | undefined>) => { for (const k of ["NODE_ENV", "MART_ADMIN", "MART_AUTH", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) delete process.env[k]; Object.assign(process.env, env); return adminAllowed(); };
  try {
    const keys = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };
    assert.equal(set({ NODE_ENV: "development" }), true);
    assert.equal(set({ NODE_ENV: "production" }), false);                                                       // today's live site
    assert.equal(set({ NODE_ENV: "production", MART_ADMIN: "enabled" }), false);                               // switch alone is not enough
    assert.equal(set({ NODE_ENV: "production", MART_ADMIN: "enabled", MART_AUTH: "demo", ...keys }), false);   // demo auth can never open production
    assert.equal(set({ NODE_ENV: "production", MART_AUTH: "supabase", ...keys }), false);                      // auth alone is not enough
    assert.equal(set({ NODE_ENV: "production", MART_ADMIN: "true", MART_AUTH: "supabase", ...keys }), false); // exact value required
    assert.equal(set({ NODE_ENV: "production", MART_ADMIN: "enabled", MART_AUTH: "supabase" }), false);        // no keys
    assert.equal(set({ NODE_ENV: "production", MART_ADMIN: "enabled", MART_AUTH: "supabase", ...keys }), true);
  } finally { for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k]; Object.assign(process.env, keep); }
});

import { resolveSiteUrl, sanitizeSiteUrl } from "../src/lib/auth/config.ts";

test("site URL resolution: separates localhost and production, sanitizes typos, and supports dynamic origins", () => {
  const keep = { ...process.env };
  try {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;

    // Default fallback
    assert.equal(resolveSiteUrl(), "http://localhost:3000");

    // Localhost request origin
    assert.equal(resolveSiteUrl("http://localhost:3000"), "http://localhost:3000");
    assert.equal(resolveSiteUrl("http://localhost:3000/"), "http://localhost:3000");

    // Production request origin
    assert.equal(resolveSiteUrl("https://meatbond-foods-mart.vercel.app"), "https://meatbond-foods-mart.vercel.app");

    // Auto-correction of previous hyphen typo
    assert.equal(resolveSiteUrl("https://meat-bond-foods-mart.vercel.app"), "https://meatbond-foods-mart.vercel.app");
    assert.equal(sanitizeSiteUrl("https://meat-bond-foods-mart.vercel.app/auth/callback"), "https://meatbond-foods-mart.vercel.app/auth/callback");

    // Vercel production system env
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "meatbond-foods-mart.vercel.app";
    assert.equal(resolveSiteUrl(), "https://meatbond-foods-mart.vercel.app");
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

    // Vercel deployment URL
    process.env.VERCEL_URL = "meatbond-foods-mart-git-feat.vercel.app";
    assert.equal(resolveSiteUrl(), "https://meatbond-foods-mart-git-feat.vercel.app");
    delete process.env.VERCEL_URL;

    // Explicit NEXT_PUBLIC_SITE_URL
    process.env.NEXT_PUBLIC_SITE_URL = "https://meatbond-foods-mart.vercel.app";
    assert.equal(resolveSiteUrl(), "https://meatbond-foods-mart.vercel.app");

    // Request origin takes precedence over env var for preview/custom domains
    assert.equal(resolveSiteUrl("http://localhost:3000"), "http://localhost:3000");
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in keep)) delete process.env[k];
    Object.assign(process.env, keep);
  }
});

