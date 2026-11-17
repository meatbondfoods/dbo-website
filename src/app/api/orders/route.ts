import { getRepositories } from "@/lib/repositories";
import { apiError, clientIp, json, rateLimited } from "@/lib/http";
import { OrderValidationError } from "@/lib/pricing";
import { idempotencyKeySchema, orderInputSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (rateLimited(`order:${clientIp(req)}`, 10, 60_000)) return apiError("Too many requests", 429);

  const key = idempotencyKeySchema.safeParse(req.headers.get("idempotency-key") ?? "");
  if (!key.success) return apiError("Idempotency-Key header is required (16-100 chars, A-Z a-z 0-9 _ -)", 400);

  let body: unknown;
  try { body = await req.json(); } catch { return apiError("Invalid JSON", 400); }
  const parsed = orderInputSchema.safeParse(body);
  if (!parsed.success) return apiError("Invalid order", 422, parsed.error.flatten());

  try {
    // Only product/option ids and quantities are used; any client-sent price is ignored.
    const order = await getRepositories().orders.createOrder(parsed.data, key.data);
    return json({
      reference: order.reference, status: order.status, subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge, total: order.total, createdAt: order.createdAt,
    }, 201);
  } catch (e) {
    if (e instanceof OrderValidationError) return apiError(e.message, 422);
    console.error("order failed", e);
    return apiError("Could not place order", 500);
  }
}
