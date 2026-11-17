import Link from "next/link";
import { ArrowUpRight, Drumstick, Beef, Egg, Package } from "lucide-react";
import type { Category } from "@/lib/domain/types";

const ICONS: Record<string, typeof Drumstick> = { "whole-chicken": Egg, "chicken-cuts": Drumstick, processed: Package, "other-meat": Beef };

export function CategoryCard({ category, count }: { category: Category; count: number }) {
  const Icon = ICONS[category.slug] ?? Package;
  return (
    <Link href={`/shop?category=${category.slug}`} className="group relative flex flex-col overflow-hidden rounded-xl border border-hairline bg-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-brand hover:shadow-lift">
      <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-mint text-brand transition-colors group-hover:bg-brand group-hover:text-white"><Icon size={26} aria-hidden /></span>
      <h3 className="mt-5 text-lg font-bold text-deep">{category.name}</h3>
      <p className="mt-1 text-sm text-ink-soft">{category.description}</p>
      <p className="mt-5 flex items-center justify-between text-sm font-semibold text-brand">
        <span>{count} product{count === 1 ? "" : "s"}</span>
        <ArrowUpRight size={18} aria-hidden className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}
