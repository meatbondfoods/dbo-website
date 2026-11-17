import "server-only";
import type { ZodType } from "zod";
import { apiError, clientIp, rateLimited, sameOrigin } from "./http";
import { currentCustomer } from "./auth/service";
import type { AccountUser } from "./auth/types";

/** Parses + validates a JSON body. Returns the data or a ready-to-send 4xx response. */
export async function parseBody<T>(req: Request, schema: ZodType<T, any, any>): Promise<{ data: T } | { res: Response }> {
  let raw: unknown;
  try { raw = await req.json(); } catch { return { res: apiError("Invalid JSON", 400) }; }
  const r = schema.safeParse(raw);
  return r.success ? { data: r.data } : { res: apiError("Invalid input", 422, r.error.flatten()) };
}

/** Guard for public auth endpoints: same-origin + per-IP rate limit. */
export function authGuard(req: Request, bucket: string, limit = 10): Response | null {
  if (!sameOrigin(req)) return apiError("Cross-site request refused", 403);
  if (rateLimited(`${bucket}:${clientIp(req)}`, limit, 60_000)) return apiError("Too many attempts. Please wait a minute.", 429);
  return null;
}

/**
 * Guard for signed-in customer endpoints. The user comes ONLY from the verified server-side session;
 * no id or role from the request body, query string or headers is ever trusted.
 */
export async function requireCustomer(req: Request, mutating: boolean): Promise<{ user: AccountUser } | { res: Response }> {
  if (mutating && !sameOrigin(req)) return { res: apiError("Cross-site request refused", 403) };
  const user = await currentCustomer();
  return user ? { user } : { res: apiError("Please sign in.", 401) };
}
