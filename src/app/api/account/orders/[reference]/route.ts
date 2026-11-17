import { apiError, json } from "@/lib/http";
import { requireCustomer } from "@/lib/routeAuth";
import { getRepositories } from "@/lib/repositories";
import { toTracked } from "@/lib/orderView";

// Looks the order up among the signed-in customer's OWN orders only. Another customer's reference is simply "not found".
export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const a = await requireCustomer(req, false); if ("res" in a) return a.res;
  const { reference } = await params;
  const order = (await getRepositories().orders.listForCustomer(a.user.customerId)).find((o) => o.reference === reference);
  return order ? json({ order: toTracked(order) }) : apiError("Order not found", 404);
}
