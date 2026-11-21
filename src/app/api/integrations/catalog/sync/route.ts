import { processCatalogSyncEvent } from "@/lib/catalog-sync-service";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return Response.json({ error: "Failed to read request body" }, { status: 400 });
  }

  const headers = {
    signature: req.headers.get("x-meatbond-signature"),
    timestamp: req.headers.get("x-meatbond-timestamp"),
    idempotencyKey: req.headers.get("x-meatbond-idempotency-key"),
  };

  const result = await processCatalogSyncEvent(rawBody, headers);

  if (result.status === 200) {
    try {
      revalidatePath("/shop");
      revalidatePath("/");
    } catch {
      // safe ignore in non-request test contexts
    }
  }

  return Response.json(result.data, { status: result.status });
}
