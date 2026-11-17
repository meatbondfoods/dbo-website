import { apiError, json, sameOrigin } from "@/lib/http";
import { logout } from "@/lib/auth/service";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return apiError("Cross-site request refused", 403);
  await logout();
  return json({ ok: true });
}
