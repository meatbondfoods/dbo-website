import { getRepositories } from "@/lib/repositories";
import { apiError, clientIp, json, rateLimited } from "@/lib/http";
import { lookupSchema } from "@/lib/validation";
import { toTracked } from "@/lib/orderView";
import { currentCustomer } from "@/lib/auth/service";

// Order tracking: signed-in customers can track directly from their session.
// Guests require the phone number used at checkout to prevent enumeration.
export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  if (rateLimited(`lookup:${clientIp(req)}`, 20, 60_000)) return apiError("Too many requests", 429);
  const { reference } = await params;

  // 1. If signed in, search the customer's authenticated orders
  const user = await currentCustomer();
  if (user) {
    const userOrders = await getRepositories().orders.listForCustomer(user.customerId, user.phone, user.email);
    const order = userOrders.find((o) => o.reference === reference);
    if (order) return json(toTracked(order));
  }

  // 2. Otherwise, check phone query parameter for guest lookup
  const phoneParam = new URL(req.url).searchParams.get("phone");
  const phone = lookupSchema.safeParse({ phone: phoneParam ?? "" });
  if (!phone.success) return apiError("A valid phone number is required", 400);

  const order = await getRepositories().orders.getOrderByReference(reference, phone.data.phone);
  if (!order) return apiError("Order not found", 404);
  return json(toTracked(order));
}
