import { getRepositories } from "@/lib/repositories";
import { json } from "@/lib/http";

export async function GET() {
  const { catalog, source } = getRepositories();
  const [categories, products] = await Promise.all([catalog.listCategories(), catalog.listProducts()]);
  return json({ source, categories, products });
}
