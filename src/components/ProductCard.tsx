import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/lib/domain/types";
import { lowestPrice, taka } from "@/lib/format";
import { Availability } from "./Availability";

export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.availability === "out_of_stock";
  return (
    <Link href={`/product/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-md border border-line bg-cream-deep">
        <Image src={product.images[0]} alt={product.name} fill unoptimized sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
          className={`object-cover transition-transform duration-500 group-hover:scale-[1.03] ${soldOut ? "opacity-60" : ""}`} />
        {product.badge && <span className="absolute left-2 top-2 rounded-sm bg-forest px-2 py-0.5 text-[11px] font-medium text-cream">{product.badge}</span>}
      </div>
      <div className="mt-3">
        <h3 className="font-serif text-base leading-snug text-charcoal group-hover:text-forest">{product.name}</h3>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm"><span className="text-charcoal/60">From </span><span className="font-semibold">{taka(lowestPrice(product.options))}</span></p>
          <Availability value={product.availability} compact />
        </div>
      </div>
    </Link>
  );
}
