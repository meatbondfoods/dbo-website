"use client";
import { ProductImage } from "@/components/ProductImage";
import Link from "next/link";
import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/domain/types";
import { useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { Availability } from "./Availability";
import { PriceDisplay } from "./ui/PriceDisplay";
import { trackAddToCart } from "@/lib/meta-pixel";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const add = useCart((s) => s.add);
  const openDrawer = useUI((s) => s.openDrawer);
  const [added, setAdded] = useState(false);
  const option = product.options[0];
  const soldOut = product.availability === "out_of_stock";
  const href = `/product/${product.slug}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-hairline bg-white shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <Link href={href} className="relative block aspect-square overflow-hidden bg-mint-light" aria-label={`${product.name}, view details`} tabIndex={-1}>
        <ProductImage src={product.images[0]} alt={product.name} priority={priority} sizes="(min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw"
          className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${soldOut ? "opacity-60 grayscale" : ""}`} />
        {product.badge && <span className="absolute left-3 top-3 rounded-md bg-gold px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-deep">{product.badge}</span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium text-ink-soft">{product.options.length > 1 ? `From ${option.label}` : option.label}</p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-deep"><Link href={href} className="hover:underline underline-offset-4">{product.name}</Link></h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <PriceDisplay amount={option.price} size="md" />
          <Availability value={product.availability} compact />
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 pt-1">
          <button disabled={soldOut} aria-label={soldOut ? `${product.name} is out of stock` : `Add ${product.name}, ${option.label}, to cart`}
            onClick={() => {
              add({ productId: product.id, optionId: option.id, quantity: 1 });
              setAdded(true);
              setTimeout(() => setAdded(false), 1800);
              openDrawer();
              trackAddToCart({
                id: product.id,
                name: product.name,
                price: option.price,
                quantity: 1,
              });
            }}
            className="btn-primary w-full">
            {added ? <><Check size={16} aria-hidden /> Added</> : <><ShoppingBag size={16} aria-hidden /> {soldOut ? "Sold out" : "Add to cart"}</>}
          </button>
          <Link href={href} className="btn-outline px-4" aria-label={`View details for ${product.name}`}>Details</Link>
        </div>
      </div>
    </article>
  );
}
