import { getStorefront } from "@/lib/content/server";
import { json } from "@/lib/http";

export async function GET() {
  const { categories, visible } = await getStorefront();
  return json({ source: "demo", categories, products: visible });
}
