import { apiError, json } from "@/lib/http";
import { parseBody, requireCustomer } from "@/lib/routeAuth";
import { addressSchema } from "@/lib/auth/schemas";
import { createAddress, listAddresses } from "@/lib/auth/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const a = await requireCustomer(req, false); if ("res" in a) return a.res;
  return json({ addresses: await listAddresses(a.user) });
}

export async function POST(req: Request) {
  const a = await requireCustomer(req, true); if ("res" in a) return a.res;
  const body = await parseBody(req, addressSchema); if ("res" in body) return body.res;
  const created = await createAddress(a.user, body.data);
  return created ? json({ address: created }, 201) : apiError("You can save up to 10 addresses.", 409);
}
