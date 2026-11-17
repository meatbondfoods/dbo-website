import { NextResponse } from "next/server";
import { adminLogout } from "@/lib/adminAuth";
import { apiError, json, sameOrigin } from "@/lib/http";

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse("Not found", { status: 404 });
  if (!sameOrigin(req)) return apiError("Cross-site request refused", 403);
  await adminLogout();
  return json({ ok: true });
}
