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
    <>
      <div className="border-b border-hairline bg-mint-light">
        <div className="container-page py-10">
          <h1 className="text-3xl sm:text-4xl">Shop</h1>
          <p className="mt-2 text-ink-soft">Fresh chicken, processed products and everyday meat. Demo catalogue with sample products.</p>
        </div>
      </div>
      <div className="container-page py-10">
        {/* key remounts the client when the URL's category/search changes (header search, category links) */}
        <ShopClient key={`${category ?? ""}|${q ?? ""}`} categories={categories} products={products} initialCategory={category ?? ""} initialQuery={q ?? ""} />
      </div>
    </>
  );
}
