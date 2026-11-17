import { json } from "@/lib/http";
import { authGuard, parseBody } from "@/lib/routeAuth";
import { forgotSchema } from "@/lib/auth/schemas";
import { resendVerification } from "@/lib/auth/service";

export async function POST(req: Request) {
  const blocked = authGuard(req, "resend", 5); if (blocked) return blocked;
  const body = await parseBody(req, forgotSchema); if ("res" in body) return body.res;
  const r = await resendVerification(body.data.email);
  return json({ ok: true, message: "If that account needs verification, a new link has been sent.", devLink: r.devLink });
}
