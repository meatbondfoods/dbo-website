import { getStorefront } from "@/lib/content/server";
import { getRepositories } from "@/lib/repositories";
import { json } from "@/lib/http";

export async function GET() {
  const { source } = getRepositories();
  const { categories, visible } = await getStorefront();
  return json({ source, categories, products: visible });
}
