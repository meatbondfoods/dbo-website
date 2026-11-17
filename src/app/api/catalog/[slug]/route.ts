import { getStorefront } from "@/lib/content/server";
import { apiError, json } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = (await getStorefront()).visible.find((p) => p.slug === slug) ?? null;
  return product ? json({ product }) : apiError("Product not found", 404);
}
