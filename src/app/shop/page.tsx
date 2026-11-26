import type { Metadata } from "next";
import { getStorefront } from "@/lib/content/server";
import { ShopClient } from "./ShopClient";

export const metadata: Metadata = { title: "Shop" };
export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams;
  const { categories, visible: products } = await getStorefront();
  return (
    <>
      <div className="border-b border-hairline bg-gradient-to-br from-mint-light via-white to-mint-light/50">
        <div className="container-page py-10 sm:py-12">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-brand shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                100% Halal · Direct from MeatBond Facility
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-deep sm:text-4xl">Fresh Meat &amp; Poultry Store</h1>
              <p className="mt-2 max-w-2xl text-sm sm:text-base text-ink-soft leading-relaxed">
                Hygienically processed chilled chicken, boneless cuts, and ready-to-cook selections — weighed to order and delivered chilled across Chattogram.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-deep">
              <span className="rounded-lg border border-hairline bg-white px-3 py-2 shadow-xs">Chilled Cold-Chain Dispatch</span>
              <span className="rounded-lg border border-hairline bg-white px-3 py-2 shadow-xs">Same-Day Chattogram Delivery</span>
              <span className="rounded-lg border border-hairline bg-white px-3 py-2 shadow-xs">Cash on Delivery</span>
            </div>
          </div>
        </div>
      </div>
      <div className="container-page py-10">
        {/* key remounts the client when the URL's category/search changes (header search, category links) */}
        <ShopClient key={`${category ?? ""}|${q ?? ""}`} categories={categories} products={products} initialCategory={category ?? ""} initialQuery={q ?? ""} />
      </div>
    </>
  );
}
