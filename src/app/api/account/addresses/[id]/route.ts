import { apiError, json } from "@/lib/http";
import { parseBody, requireCustomer } from "@/lib/routeAuth";
import { addressSchema } from "@/lib/auth/schemas";
import { deleteAddress, updateAddress } from "@/lib/auth/service";

type Ctx = { params: Promise<{ id: string }> };
const validId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// Both handlers act only on the signed-in customer's own addresses. Someone else's id returns 404, never 403,
// so the existence of other customers' records is not revealed.
export async function PUT(req: Request, { params }: Ctx) {
  const a = await requireCustomer(req, true); if ("res" in a) return a.res;
  const { id } = await params; if (!validId(id)) return apiError("Address not found", 404);
  const body = await parseBody(req, addressSchema); if ("res" in body) return body.res;
  const updated = await updateAddress(a.user, id, body.data);
  return updated ? json({ address: updated }) : apiError("Address not found", 404);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await requireCustomer(req, true); if ("res" in a) return a.res;
  const { id } = await params; if (!validId(id)) return apiError("Address not found", 404);
  return (await deleteAddress(a.user, id)) ? json({ ok: true }) : apiError("Address not found", 404);
}
