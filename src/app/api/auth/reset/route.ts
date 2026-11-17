import { apiError, json } from "@/lib/http";
import { authGuard, parseBody } from "@/lib/routeAuth";
import { resetSchema } from "@/lib/auth/schemas";
import { resetPassword } from "@/lib/auth/service";

export async function POST(req: Request) {
  const blocked = authGuard(req, "reset", 8); if (blocked) return blocked;
  const body = await parseBody(req, resetSchema); if ("res" in body) return body.res;
  const r = await resetPassword(body.data.token, body.data.password);
  return r.ok ? json({ ok: true }) : apiError(r.error, 422);
}
