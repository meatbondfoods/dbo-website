import { apiError, json } from "@/lib/http";
import { authGuard, parseBody } from "@/lib/routeAuth";
import { loginSchema } from "@/lib/auth/schemas";
import { accountsEnabled, login } from "@/lib/auth/service";

export async function POST(req: Request) {
  const blocked = authGuard(req, "login", 10); if (blocked) return blocked;
  if (!accountsEnabled()) return apiError("Accounts are not available yet.", 503);
  const body = await parseBody(req, loginSchema); if ("res" in body) return body.res;
  const r = await login(body.data.email, body.data.password);
  if (!r.ok) return json({ error: r.error, code: r.code }, r.code === "locked" ? 429 : 401);
  return json({ ok: true });
}
