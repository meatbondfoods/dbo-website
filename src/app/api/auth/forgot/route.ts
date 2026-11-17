import { json } from "@/lib/http";
import { authGuard, parseBody } from "@/lib/routeAuth";
import { forgotSchema } from "@/lib/auth/schemas";
import { forgot } from "@/lib/auth/service";

// Always answers the same way, so it cannot be used to discover which emails have accounts.
export async function POST(req: Request) {
  const blocked = authGuard(req, "forgot", 5); if (blocked) return blocked;
  const body = await parseBody(req, forgotSchema); if ("res" in body) return body.res;
  const r = await forgot(body.data.email);
  return json({ ok: true, message: "If an account exists for that email, a reset link has been sent.", devLink: r.devLink });
}
