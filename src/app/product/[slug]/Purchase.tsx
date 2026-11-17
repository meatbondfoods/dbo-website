"use client";
import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import type { Product } from "@/lib/domain/types";
import { taka } from "@/lib/format";
import { useCart } from "@/store/cart";

export function Purchase({ product }: { product: Product }) {
  const [optionId, setOptionId] = useState(product.options[0].id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);
  const option = product.options.find((o) => o.id === optionId)!;
  const soldOut = product.availability === "out_of_stock";

  return (
    <div className="mt-6">
      <p className="font-serif text-3xl text-charcoal">{taka(option.price * qty)}</p>
      <fieldset className="mt-5">
        <legend className="label">Weight</legend>
        <div className="flex flex-wrap gap-2">
          {product.options.map((o) => (
            <button key={o.id} onClick={() => { setOptionId(o.id); setAdded(false); }} aria-pressed={o.id === optionId}
              className={`rounded-md border px-4 py-2 text-sm transition-colors ${o.id === optionId ? "border-forest bg-forest text-cream" : "border-line bg-white hover:border-forest"}`}>
              {o.label} · {taka(o.price)}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <div className="inline-flex items-center rounded-md border border-line bg-white" role="group" aria-label="Quantity">
          <button aria-label="Decrease quantity" className="p-3 disabled:opacity-40" disabled={qty <= 1} onClick={() => setQty(qty - 1)}><Minus size={16} /></button>
          <span className="w-8 text-center text-sm" aria-live="polite">{qty}</span>
          <button aria-label="Increase quantity" className="p-3 disabled:opacity-40" disabled={qty >= 50} onClick={() => setQty(qty + 1)}><Plus size={16} /></button>
        </div>
        <button className="btn-primary flex-1 sm:flex-none sm:px-10" disabled={soldOut}
          onClick={() => { add({ productId: product.id, optionId, quantity: qty }); setAdded(true); }}>
          {soldOut ? "Out of stock" : "Add to cart"}
        </button>
      </div>
      <p role="status" className="mt-3 min-h-5 text-sm text-forest">
        {added && <>Added to cart. <Link href="/cart" className="font-medium underline">View cart</Link></>}
      </p>
    </div>
  );
}
