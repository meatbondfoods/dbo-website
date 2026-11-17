import { requireAdminApi } from "@/lib/adminAuth";
import { apiError, json } from "@/lib/http";
import { isContentKey } from "@/lib/content/schema";
import { discardDraft, getAdminState, saveDraft } from "@/lib/content/store";
import { checkTheme } from "@/lib/content/contrast";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const g = await requireAdminApi(req, "viewer"); if ("res" in g) return g.res;
  const { key } = await params;
  if (!isContentKey(key)) return apiError("Unknown content key", 404);
  return json(getAdminState(key));
}

// Saves a DRAFT only. The live site is unaffected until the draft is published.
export async function PUT(req: Request, { params }: Ctx) {
  const g = await requireAdminApi(req, "editor"); if ("res" in g) return g.res;
  const { key } = await params;
  if (!isContentKey(key)) return apiError("Unknown content key", 404);
  const body = await req.json().catch(() => undefined);
  const res = saveDraft(key, body);
  if (!res.ok) return apiError("Invalid content", 422, res.errors);
  const state = getAdminState(key);
  return json({ saved: true, ...(key === "theme" ? { contrast: checkTheme(state.draft as Parameters<typeof checkTheme>[0]) } : {}) });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const g = await requireAdminApi(req, "editor"); if ("res" in g) return g.res;
  const { key } = await params;
  if (!isContentKey(key)) return apiError("Unknown content key", 404);
  discardDraft(key);
  return json({ discarded: true });
}
