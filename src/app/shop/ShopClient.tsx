"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Category, Product } from "@/lib/domain/types";
import { lowestPrice, taka } from "@/lib/format";
import { ProductCard } from "@/components/ProductCard";

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

export function ShopClient({ categories, products, initialCategory, initialQuery }: {
  categories: Category[]; products: Product[]; initialCategory: string; initialQuery: string;
}) {
  const maxPrice = Math.max(...products.map((p) => lowestPrice(p.options)));
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<Sort>("featured");
  const [price, setPrice] = useState(maxPrice);
  const [inStockOnly, setInStockOnly] = useState(false);

  const catId = categories.find((c) => c.slug === category)?.id;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) =>
      (!catId || p.categoryId === catId) &&
      lowestPrice(p.options) <= price &&
      (!inStockOnly || p.availability !== "out_of_stock") &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)));
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      featured: () => 0,
      "price-asc": (a, b) => lowestPrice(a.options) - lowestPrice(b.options),
      "price-desc": (a, b) => lowestPrice(b.options) - lowestPrice(a.options),
      rating: (a, b) => b.rating - a.rating,
    };
    return [...list].sort(by[sort]);
  }, [products, catId, price, inStockOnly, query, sort]);

  const reset = () => { setCategory(""); setQuery(""); setPrice(maxPrice); setInStockOnly(false); setSort("featured"); };

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
      <aside aria-label="Filters" className="space-y-6">
        <div>
          <label htmlFor="q" className="label">Search</label>
          <div className="relative"><Search size={16} className="absolute left-3 top-3 text-charcoal/40" aria-hidden />
            <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products" className="input pl-9" /></div>
        </div>
        <fieldset>
          <legend className="label">Category</legend>
          <div className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
            {[{ slug: "", name: "All products" }, ...categories].map((c) => (
              <button key={c.slug} onClick={() => setCategory(c.slug)} aria-pressed={category === c.slug}
                className={`rounded-md border px-3 py-1.5 text-left text-sm transition-colors ${category === c.slug ? "border-forest bg-forest text-cream" : "border-line bg-white hover:border-forest"}`}>{c.name}</button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="price" className="label">Max price: {taka(price)}</label>
          <input id="price" type="range" min={0} max={maxPrice} step={10} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full accent-[#1F3D2B]" />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-[#1F3D2B]" />In stock only</label>
      </aside>

      <div>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-charcoal/65" role="status">{shown.length} product{shown.length === 1 ? "" : "s"}</p>
          <div className="flex items-center gap-2">
            <label htmlFor="sort" className="text-sm">Sort</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input w-auto">
              <option value="featured">Featured</option><option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option><option value="rating">Top rated</option>
            </select>
          </div>
        </div>
        {shown.length === 0 ? (
          <div className="mt-8 rounded-md border border-dashed border-line bg-white p-10 text-center">
            <p className="font-serif text-xl">No products match your filters</p>
            <p className="mt-2 text-sm text-charcoal/65">Try a different search or clear the filters.</p>
            <button onClick={reset} className="btn-outline mt-5">Clear filters</button>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">{shown.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        )}
      </div>
    </div>
  );
}
