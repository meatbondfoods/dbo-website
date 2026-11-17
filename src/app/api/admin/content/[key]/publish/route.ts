import { requireAdminApi } from "@/lib/adminAuth";
import { apiError, json } from "@/lib/http";
import { isContentKey } from "@/lib/content/schema";
import { publish } from "@/lib/content/store";

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const g = await requireAdminApi(req, "owner"); if ("res" in g) return g.res;
  const { key } = await params;
  if (!isContentKey(key)) return apiError("Unknown content key", 404);
  const res = publish(key);
  return res.ok ? json({ published: true, version: res.version }) : apiError(res.error, 422);
}
