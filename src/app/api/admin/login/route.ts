import { z } from "zod";
import { NextResponse } from "next/server";
import { adminLogin } from "@/lib/adminAuth";
import { apiError, clientIp, json, rateLimited, sameOrigin } from "@/lib/http";
import { adminAllowed } from "@/lib/adminGate";

export async function POST(req: Request) {
  if (!adminAllowed()) return new NextResponse("Not found", { status: 404 });
  if (!sameOrigin(req)) return apiError("Cross-site request refused", 403);
  if (rateLimited(`adminlogin:${clientIp(req)}`, 8, 60_000)) return apiError("Too many attempts. Please wait a minute.", 429);
  const p = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return apiError("Invalid input", 422);
  const r = await adminLogin(p.data.email, p.data.password);
  return r.ok ? json({ ok: true }) : apiError(r.error, 401);
}
