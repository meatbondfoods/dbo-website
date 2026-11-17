import { draftMode } from "next/headers";
import { adminGuard } from "@/lib/adminGuard";
import { apiError, json } from "@/lib/http";

// Turns Next.js draft mode on/off so the admin can see unpublished DRAFT content on the real site.
export async function POST(req: Request) {
  const blocked = adminGuard(req); if (blocked) return blocked;
  const body = await req.json().catch(() => null) as { enable?: boolean } | null;
  if (typeof body?.enable !== "boolean") return apiError("enable (boolean) is required", 400);
  const dm = await draftMode();
  if (body.enable) dm.enable(); else dm.disable();
  return json({ preview: body.enable });
}
