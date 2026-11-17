import { apiError, json } from "@/lib/http";
import { requireCustomer } from "@/lib/routeAuth";
import { setDefaultAddress } from "@/lib/auth/service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireCustomer(req, true); if ("res" in a) return a.res;
  const { id } = await params;
  return /^[0-9a-f-]{36}$/i.test(id) && (await setDefaultAddress(a.user, id)) ? json({ ok: true }) : apiError("Address not found", 404);
}
