"use client";
import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { Category, Product } from "@/lib/domain/types";
import { lowestPrice, taka } from "@/lib/format";
import { ProductGrid } from "@/components/ProductGrid";
import { Button } from "@/components/ui/Button";

type Sort = "featured" | "offers" | "price-asc" | "price-desc" | "rating";

export function ShopClient({ categories, products, initialCategory, initialQuery }: {
  categories: Category[]; products: Product[]; initialCategory: string; initialQuery: string;
}) {
  const maxPrice = Math.max(0, ...products.map((p) => lowestPrice(p.options)));
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<Sort>("featured");
  const [price, setPrice] = useState(maxPrice);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasDiscount = (p: Product) => p.options.some((o) => o.compareAtPrice != null && o.compareAtPrice > o.price);
  const maxDiscount = (p: Product) => Math.max(0, ...p.options.map((o) => (o.compareAtPrice && o.compareAtPrice > o.price ? o.compareAtPrice - o.price : 0)));

  const catId = categories.find((c) => c.slug === category)?.id;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) =>
      (!catId || p.categoryId === catId) && lowestPrice(p.options) <= price &&
      (!inStockOnly || p.availability !== "out_of_stock") &&
      (!offersOnly || hasDiscount(p)) &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)));
    const by: Record<Sort, (a: Product, b: Product) => number> = {
      featured: () => 0,
      offers: (a, b) => maxDiscount(b) - maxDiscount(a),
      "price-asc": (a, b) => lowestPrice(a.options) - lowestPrice(b.options),
      "price-desc": (a, b) => lowestPrice(b.options) - lowestPrice(a.options),
      rating: (a, b) => b.rating - a.rating,
    };
    return [...list].sort(by[sort]);
  }, [products, catId, price, inStockOnly, offersOnly, query, sort]);

  const filtered = !!category || !!query || price < maxPrice || inStockOnly || offersOnly;
  const reset = () => { setCategory(""); setQuery(""); setPrice(maxPrice); setInStockOnly(false); setOffersOnly(false); setSort("featured"); };
  const chip = (on: boolean) => `chip ${on ? "border-brand bg-brand text-white" : "border-ink-soft/40 bg-white text-ink hover:border-brand"}`;

  const filters = (
    <div className="space-y-7">
      <div>
        <label htmlFor="q" className="label">Search</label>
        <input id="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chicken, beef, cuts..." className="input" />
      </div>
      <fieldset>
        <legend className="label">Category</legend>
        <div className="flex flex-wrap gap-2">
          {[{ slug: "", name: "All" }, ...categories].map((c) => <button key={c.slug} onClick={() => setCategory(c.slug)} aria-pressed={category === c.slug} className={chip(category === c.slug)}>{c.name}</button>)}
        </div>
      </fieldset>
      <div>
        <label htmlFor="price" className="label">Maximum price: <span className="font-bold text-deep">{taka(price)}</span></label>
        <input id="price" type="range" min={0} max={maxPrice} step={10} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-brand" />
      </div>
      <div className="space-y-1">
        <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-5 w-5 accent-brand" />In stock only</label>
        <label className="flex min-h-[40px] cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" checked={offersOnly} onChange={(e) => setOffersOnly(e.target.checked)} className="h-5 w-5 accent-brand" />Special offers only</label>
      </div>
      {filtered && <Button variant="outline" onClick={reset} className="w-full">Clear all filters</Button>}
    </div>
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
      <aside aria-label="Filters" className="hidden h-fit rounded-xl border border-hairline bg-white p-6 shadow-soft lg:block">{filters}</aside>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-soft" role="status" aria-live="polite">{shown.length} product{shown.length === 1 ? "" : "s"}{catId ? ` in ${categories.find((c) => c.id === catId)?.name}` : ""}</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="lg:hidden" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>{filtersOpen ? <X size={16} aria-hidden /> : <SlidersHorizontal size={16} aria-hidden />} Filters</Button>
            <label htmlFor="sort" className="sr-only">Sort products</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input w-auto">
              <option value="featured">Featured</option>
              <option value="offers">Best offers first</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>
        </div>
        {filtersOpen && <div className="mt-4 rounded-xl border border-hairline bg-white p-5 shadow-soft lg:hidden">{filters}</div>}

        {shown.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-ink-soft/40 bg-white p-12 text-center">
            <p className="text-xl font-bold text-deep">No products match your filters</p>
            <p className="mt-2 text-sm text-ink-soft">Try a different search, or clear the filters to see everything.</p>
            <Button onClick={reset} className="mt-6">Clear filters</Button>
          </div>
        ) : <div className="mt-6"><ProductGrid products={shown} columns={3} /></div>}
      </div>
    </div>
  );
}
