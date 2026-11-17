import { NextResponse } from "next/server";

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

export const apiError = (message: string, status: number, details?: unknown) =>
  json({ error: message, ...(details ? { details } : {}) }, status);

// Minimal fixed-window limiter. In-memory, so per-instance only: swap for a shared
// store (e.g. Upstash / Vercel KV) before relying on it in production.
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return false; }
  h.n += 1;
  return h.n > limit;
}
export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

/** CSRF defence for cookie-authenticated mutations: refuse requests that originate from another site. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin) { try { return new URL(origin).host === req.headers.get("host"); } catch { return false; } }
  return req.headers.get("sec-fetch-site") !== "cross-site";
}
