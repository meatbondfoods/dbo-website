import { apiError, json } from "@/lib/http";
import { authGuard, parseBody } from "@/lib/routeAuth";
import { registerSchema } from "@/lib/auth/schemas";
import { accountsEnabled, register } from "@/lib/auth/service";

export async function POST(req: Request) {
  const blocked = authGuard(req, "register", 5); if (blocked) return blocked;
  if (!accountsEnabled()) return apiError("Accounts are not available yet.", 503);
  const body = await parseBody(req, registerSchema); if ("res" in body) return body.res;
  const r = await register(body.data);
  if (!r.ok) return apiError(r.error, 422);
  // The same response is returned whether or not the email already exists (no account enumeration).
  return json({ ok: true, message: "Check your email for a verification link.", devLink: "devLink" in r ? r.devLink : undefined });
}
