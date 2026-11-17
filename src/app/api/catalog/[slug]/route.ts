import { getRepositories } from "@/lib/repositories";
import { apiError, json } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getRepositories().catalog.getProductBySlug(slug);
  return product ? json({ product }) : apiError("Product not found", 404);
}
