import { z } from "zod";
import { apiError, json } from "@/lib/http";
import { authGuard, parseBody } from "@/lib/routeAuth";
import { verifyEmail } from "@/lib/auth/service";

// A POST (not a GET link) so a mail scanner or link-preview bot cannot consume the one-time token.
export async function POST(req: Request) {
  const blocked = authGuard(req, "verify", 10); if (blocked) return blocked;
  const body = await parseBody(req, z.object({ token: z.string().min(20).max(200) })); if ("res" in body) return body.res;
  const r = await verifyEmail(body.data.token);
  return r.ok ? json({ ok: true }) : apiError(r.error, 422);
}
