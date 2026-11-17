import type { Product } from "@/lib/domain/types";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products, columns = 4 }: { products: Product[]; columns?: 3 | 4 }) {
  const cols = columns === 3 ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
  return <div className={`grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 sm:gap-6 ${cols}`}>{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>;
}
