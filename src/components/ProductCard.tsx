"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ShoppingBag } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import type { Product } from "@/lib/domain/types";
import { useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { PriceDisplay } from "./ui/PriceDisplay";
import { trackAddToCart } from "@/lib/meta-pixel";

export function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  const add = useCart((s) => s.add);
  const openDrawer = useUI((s) => s.openDrawer);
  const [added, setAdded] = useState(false);
  const option = product.options[0];
  const soldOut = product.availability === "out_of_stock";
  const lowStock = product.availability === "low_stock";
  const href = `/product/${product.slug}`;
  const hasOffer = option.compareAtPrice != null && option.compareAtPrice > option.price;
  const offerPct = hasOffer && option.compareAtPrice
    ? Math.max(1, Math.round(((option.compareAtPrice - option.price) / option.compareAtPrice) * 100))
    : 0;

  const handleAddToCart = () => {
    if (soldOut) return;
    add({ productId: product.id, optionId: option.id, quantity: 1 });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
    openDrawer();
    trackAddToCart({
      id: product.id,
      name: product.name,
      price: option.price,
      quantity: 1,
    });
  };

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-hairline/90 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-brand/35 hover:shadow-lift">
      <div>
        {/* Product Image Container */}
        <Link
          href={href}
          className="relative block aspect-[4/3] sm:aspect-square w-full overflow-hidden bg-gradient-to-b from-canvas to-mint-light/40"
          aria-label={`${product.name}, view details`}
          tabIndex={-1}
        >
          <ProductImage
            src={product.images[0]}
            alt={product.name}
            priority={priority}
            sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"
            className={`object-cover object-center transition-transform duration-500 group-hover:scale-105 ${
              soldOut ? "opacity-60 grayscale" : ""
            }`}
          />

          {/* Promotional / Marketing Badge */}
          {product.badge ? (
            <span className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-deep shadow-sm">
              {product.badge}
            </span>
          ) : hasOffer ? (
            <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
              {offerPct}% OFF
            </span>
          ) : null}

          {/* Stock Status Badge */}
          <span
            className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-md shadow-sm ${
              soldOut
                ? "bg-zinc-800/85 text-white"
                : lowStock
                ? "bg-amber-500/90 text-white"
                : "bg-white/95 text-leaf border border-brand/10"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                soldOut ? "bg-zinc-400" : lowStock ? "bg-white" : "bg-success"
              }`}
            />
            {soldOut ? "Sold out" : lowStock ? "Low stock" : "In stock"}
          </span>
        </Link>

        {/* Card Body */}
        <div className="p-4 sm:p-5">
          {/* Pack size & portion tag */}
          <p className="text-[11px] font-bold uppercase tracking-wider text-leaf">
            {product.options.length > 1 ? `Starting from ${option.label}` : option.label}
          </p>

          {/* Product Name */}
          <h3 className="mt-1 text-base sm:text-lg font-bold text-deep leading-snug line-clamp-2 min-h-[2.75rem] transition-colors group-hover:text-brand">
            <Link href={href}>{product.name}</Link>
          </h3>

          {/* Price & Quality Trust Tag */}
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <PriceDisplay amount={option.price} compareAt={option.compareAtPrice} size="lg" />
            {option.compareAtPrice && option.compareAtPrice > option.price ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                Save ৳{(option.compareAtPrice - option.price).toLocaleString("en-BD")}
              </span>
            ) : (
              <span className="text-[11px] font-medium text-ink-soft">Chilled cut</span>
            )}
          </div>
        </div>
      </div>

      {/* Card Actions */}
      <div className="p-4 sm:p-5 pt-0">
        <div className="grid grid-cols-[1fr_auto] gap-2 pt-2 border-t border-hairline/70">
          <button
            type="button"
            disabled={soldOut}
            aria-label={soldOut ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
            onClick={handleAddToCart}
            className={`btn font-bold transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
              added
                ? "bg-success text-white shadow-soft"
                : "btn-primary w-full shadow-soft hover:bg-deep active:scale-95"
            }`}
          >
            {added ? (
              <>
                <Check size={16} aria-hidden="true" />
                <span>Added ✓</span>
              </>
            ) : (
              <>
                <ShoppingBag size={16} aria-hidden="true" />
                <span>{soldOut ? "Sold out" : "Add to cart"}</span>
              </>
            )}
          </button>

          <Link
            href={href}
            className="btn-outline px-3.5 text-xs font-semibold hover:bg-mint-light"
            aria-label={`View details for ${product.name}`}
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  );
}
