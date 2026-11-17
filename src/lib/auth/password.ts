// Password hashing with scrypt (node:crypto). Passwords are NEVER stored or logged in plain text.
// In Supabase mode Supabase Auth owns password storage; this module serves the development demo provider only.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const N = 16384, R = 8, P = 1, KEYLEN = 64;
const scrypt = (pw: string, salt: Buffer) => new Promise<Buffer>((res, rej) =>
  scryptCb(pw, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, keyB64] = stored.split("$");
  if (alg !== "scrypt" || Number(n) !== N || Number(r) !== R || Number(p) !== P || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const COMMON = new Set(["password123", "1234567890", "qwerty12345", "password1234", "iloveyou123", "admin12345", "welcome1234", "letmein1234"]);

/** Returns an error message, or null when the password is acceptable. */
export function validatePassword(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (pw.length > 128) return "Use at most 128 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "Include at least one letter and one number.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common.";
  return null;
}
