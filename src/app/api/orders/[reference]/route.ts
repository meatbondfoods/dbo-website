import { getRepositories } from "@/lib/repositories";
import { apiError, clientIp, json, rateLimited } from "@/lib/http";
import { lookupSchema } from "@/lib/validation";
import { toTracked } from "@/lib/orderView";

// Order tracking requires the reference AND the phone used at checkout, so references can't be enumerated.
export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  if (rateLimited(`lookup:${clientIp(req)}`, 20, 60_000)) return apiError("Too many requests", 429);
  const { reference } = await params;
  const phone = lookupSchema.safeParse({ phone: new URL(req.url).searchParams.get("phone") ?? "" });
  if (!phone.success) return apiError("A valid phone number is required", 400);

  const order = await getRepositories().orders.getOrderByReference(reference, phone.data.phone);
  if (!order) return apiError("Order not found", 404);
  return json(toTracked(order));
}
