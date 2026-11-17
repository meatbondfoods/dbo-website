import { z } from "zod";
import { requireAdminApi } from "@/lib/adminAuth";
import { apiError, json } from "@/lib/http";
import { simulateStatus } from "@/lib/repositories/demo";

const body = z.object({ status: z.enum(["pending_confirmation", "confirmed", "processing", "ready", "dispatched", "delivered", "on_hold", "rejected", "cancelled"]) });

// DEMO ONLY: stands in for ERP staff so the customer's tracking timeline can be exercised in development.
// In production the status comes from the ERP; website admins never confirm or dispatch orders.
export async function POST(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  const g = await requireAdminApi(req, "editor"); if ("res" in g) return g.res;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return apiError("Invalid status", 422);
  const order = simulateStatus((await params).reference, parsed.data.status);
  return order ? json({ reference: order.reference, status: order.status }) : apiError("Order not found", 404);
}
