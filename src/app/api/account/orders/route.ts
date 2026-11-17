import { json } from "@/lib/http";
import { requireCustomer } from "@/lib/routeAuth";
import { getRepositories } from "@/lib/repositories";
import { toTracked } from "@/lib/orderView";

export async function GET(req: Request) {
  const a = await requireCustomer(req, false); if ("res" in a) return a.res;
  const orders = await getRepositories().orders.listForCustomer(a.user.customerId);
  return json({ orders: orders.map(toTracked) });
}
