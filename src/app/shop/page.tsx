import type { Metadata } from "next";
import { getRepositories } from "@/lib/repositories";
import { ShopClient } from "./ShopClient";

export const metadata: Metadata = { title: "Shop" };
export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams;
  const { catalog } = getRepositories();
  const [categories, products] = await Promise.all([catalog.listCategories(), catalog.listProducts()]);
  return (
    <div className="container-page py-10">
      <h1 className="text-4xl">Shop</h1>
      <p className="mt-2 text-sm text-charcoal/65">Fresh chicken, beef, mutton and processed foods.</p>
      <ShopClient categories={categories} products={products} initialCategory={category ?? ""} initialQuery={q ?? ""} />
    </div>
  );
}
