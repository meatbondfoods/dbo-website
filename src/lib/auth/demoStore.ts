// DEVELOPMENT account store (file-backed JSON). NOT used in production: auth mode "demo" is refused there
// (see config.ts). Deliberately free of "server-only" so it can be unit-tested; never import it from client code.
// Single-process only: reads-modify-writes the whole file, which is fine for one local dev server.
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { formatCustomerCode } from "../identity.ts";

export interface UserRec { id: string; email: string; passwordHash: string; verifiedAt: string | null; createdAt: string; failed: number; lockedUntil: number; pendingName?: string; pendingPhone?: string }
export interface CustomerRec { id: string; userId: string; customerCode: string; fullName: string; phone: string; createdAt: string }
export interface AddressRec { id: string; customerId: string; fullName: string; phone: string; line1: string; area: string; city: string; postalCode: string; instructions: string; isDefault: boolean; createdAt: string }
interface TokenRec { hash: string; userId: string; kind: "verify" | "reset"; expires: number; used: boolean }
interface SessionRec { hash: string; userId: string; scope: "customer" | "admin"; expires: number }
export interface AdminRec { userId: string; role: "owner" | "editor" | "viewer" }
interface Db { seq: number; users: UserRec[]; customers: CustomerRec[]; addresses: AddressRec[]; tokens: TokenRec[]; sessions: SessionRec[]; admins: AdminRec[] }

const empty = (): Db => ({ seq: 0, users: [], customers: [], addresses: [], tokens: [], sessions: [], admins: [] });
const file = () => path.join(process.env.MART_DATA_DIR ?? path.join(process.cwd(), ".data"), "accounts.json");

function read(): Db {
  try { return { ...empty(), ...JSON.parse(fs.readFileSync(file(), "utf8")) }; } catch { return empty(); }
}
function write(db: Db) {
  const f = file();
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, f);                       // atomic replace
}
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");

// ---- users ---------------------------------------------------------------------------------
export function findUserByEmail(email: string) { return read().users.find((u) => u.email === email.toLowerCase()) ?? null; }
export function findUserById(id: string) { return read().users.find((u) => u.id === id) ?? null; }

export function createUser(email: string, passwordHash: string, pending?: { name: string; phone: string }): UserRec | null {
  const db = read();
  const e = email.toLowerCase();
  if (db.users.some((u) => u.email === e)) return null;          // one account per email (case-insensitive)
  const u: UserRec = { id: randomUUID(), email: e, passwordHash, verifiedAt: null, createdAt: new Date().toISOString(), failed: 0, lockedUntil: 0, pendingName: pending?.name, pendingPhone: pending?.phone };
  db.users.push(u); write(db); return u;
}
export function updateUser(id: string, patch: Partial<Pick<UserRec, "passwordHash" | "failed" | "lockedUntil" | "verifiedAt" | "pendingName" | "pendingPhone">>) {
  const db = read(); const u = db.users.find((x) => x.id === id); if (!u) return; Object.assign(u, patch); write(db);
}

// ---- one-time tokens (only the hash is stored) ----------------------------------------------
export function createToken(userId: string, kind: "verify" | "reset", ttlMs: number): string {
  const db = read(); const raw = newToken();
  db.tokens = db.tokens.filter((t) => !(t.userId === userId && t.kind === kind));   // a new token replaces the old one
  db.tokens.push({ hash: sha(raw), userId, kind, expires: Date.now() + ttlMs, used: false });
  write(db); return raw;
}
export function consumeToken(raw: string, kind: "verify" | "reset"): string | null {
  const db = read(); const t = db.tokens.find((x) => x.hash === sha(raw) && x.kind === kind);
  if (!t || t.used || t.expires < Date.now()) return null;
  t.used = true; write(db); return t.userId;
}

// ---- customers: the permanent MBM-CUS id comes from one monotonically increasing counter ------
/** Idempotent: returns the existing customer, otherwise issues the next never-reused customer code. */
export function ensureCustomer(userId: string, fullName: string, phone: string): CustomerRec {
  const db = read();
  const existing = db.customers.find((c) => c.userId === userId);
  if (existing) return existing;
  db.seq += 1;                                                    // never decremented, so a code is never reissued
  const c: CustomerRec = { id: randomUUID(), userId, customerCode: formatCustomerCode(db.seq), fullName, phone, createdAt: new Date().toISOString() };
  db.customers.push(c); write(db); return c;
}
export function getCustomerByUser(userId: string) { return read().customers.find((c) => c.userId === userId) ?? null; }
export function getCustomer(id: string) { return read().customers.find((c) => c.id === id) ?? null; }
/** Only name and phone can change. customerCode, id and userId are immutable by construction. */
export function updateCustomer(id: string, patch: { fullName: string; phone: string }) {
  const db = read(); const c = db.customers.find((x) => x.id === id); if (!c) return null;
  c.fullName = patch.fullName; c.phone = patch.phone; write(db); return c;
}

// ---- sessions (cookie holds the raw token; store keeps the hash) -----------------------------
export function createSession(userId: string, scope: "customer" | "admin", ttlMs: number): string {
  const db = read(); const raw = newToken();
  db.sessions = db.sessions.filter((s) => s.expires > Date.now());
  db.sessions.push({ hash: sha(raw), userId, scope, expires: Date.now() + ttlMs });
  write(db); return raw;
}
export function getSessionUser(raw: string | undefined, scope: "customer" | "admin"): UserRec | null {
  if (!raw) return null;
  const db = read(); const s = db.sessions.find((x) => x.hash === sha(raw) && x.scope === scope);
  if (!s || s.expires < Date.now()) return null;
  return db.users.find((u) => u.id === s.userId && u.verifiedAt) ?? null;
}
export function deleteSession(raw: string | undefined) {
  if (!raw) return; const db = read(); db.sessions = db.sessions.filter((s) => s.hash !== sha(raw)); write(db);
}
export function deleteSessionsFor(userId: string) {
  const db = read(); db.sessions = db.sessions.filter((s) => s.userId !== userId); write(db);
}

// ---- addresses: EVERY operation is scoped to the owning customerId -----------------------------
const MAX_ADDRESSES = 10;
type AddrFields = Omit<AddressRec, "id" | "customerId" | "createdAt">;
export function listAddresses(customerId: string) { return read().addresses.filter((a) => a.customerId === customerId); }
export function createAddress(customerId: string, data: AddrFields): AddressRec | null {
  const db = read(); const mine = db.addresses.filter((a) => a.customerId === customerId);
  if (mine.length >= MAX_ADDRESSES) return null;
  const isDefault = data.isDefault || mine.length === 0;
  if (isDefault) db.addresses.forEach((a) => { if (a.customerId === customerId) a.isDefault = false; });
  const a: AddressRec = { ...data, isDefault, id: randomUUID(), customerId, createdAt: new Date().toISOString() };
  db.addresses.push(a); write(db); return a;
}
export function updateAddress(customerId: string, id: string, data: AddrFields): AddressRec | null {
  const db = read(); const a = db.addresses.find((x) => x.id === id && x.customerId === customerId);   // ownership check
  if (!a) return null;
  const wasDefault = a.isDefault;
  if (data.isDefault) db.addresses.forEach((x) => { if (x.customerId === customerId) x.isDefault = false; });
  Object.assign(a, data);
  a.isDefault = data.isDefault || wasDefault;      // editing never un-defaults the only default; choose another to move it
  write(db); return a;
}
export function deleteAddress(customerId: string, id: string): boolean {
  const db = read(); const a = db.addresses.find((x) => x.id === id && x.customerId === customerId);   // ownership check
  if (!a) return false;
  db.addresses = db.addresses.filter((x) => x.id !== id);
  const rest = db.addresses.filter((x) => x.customerId === customerId);
  if (a.isDefault && rest.length) rest[0].isDefault = true;      // promote another address to default
  write(db); return true;
}
export function setDefaultAddress(customerId: string, id: string): boolean {
  const db = read(); const a = db.addresses.find((x) => x.id === id && x.customerId === customerId);
  if (!a) return false;
  db.addresses.forEach((x) => { if (x.customerId === customerId) x.isDefault = x.id === id; });
  write(db); return true;
}

// ---- website admins (role is looked up HERE, on the server, never trusted from the browser) ----
export function getAdminRole(userId: string): AdminRec["role"] | null { return read().admins.find((a) => a.userId === userId)?.role ?? null; }
export function setAdmin(userId: string, role: AdminRec["role"]) {
  const db = read(); const a = db.admins.find((x) => x.userId === userId);
  if (a) a.role = role; else db.admins.push({ userId, role }); write(db);
}
