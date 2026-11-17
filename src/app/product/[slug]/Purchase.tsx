"use client";
import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/domain/types";
import { useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { PriceDisplay } from "@/components/ui/PriceDisplay";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { Button, ButtonLink } from "@/components/ui/Button";

export function Purchase({ product }: { product: Product }) {
  const [optionId, setOptionId] = useState(product.options[0].id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);
  const openDrawer = useUI((s) => s.openDrawer);
  const option = product.options.find((o) => o.id === optionId)!;
  const soldOut = product.availability === "out_of_stock";

  return (
    <div className="mt-6">
      <PriceDisplay amount={option.price * qty} size="lg" />
      {qty > 1 && <p className="mt-1 text-sm text-ink-soft">{qty} × ৳{option.price.toLocaleString("en-BD")}</p>}
      <fieldset className="mt-6">
        <legend className="label">Weight</legend>
        <div className="flex flex-wrap gap-2.5">
          {product.options.map((o) => (
            <button key={o.id} onClick={() => { setOptionId(o.id); setAdded(false); }} aria-pressed={o.id === optionId}
              className={`min-h-[44px] rounded-lg border px-4 text-sm font-semibold transition-colors ${o.id === optionId ? "border-brand bg-brand text-white" : "border-ink-soft/50 bg-white text-ink hover:border-brand"}`}>
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <QuantitySelector value={qty} onChange={setQty} label={product.name} />
        <Button className="min-w-[180px] flex-1 sm:flex-none sm:px-10" disabled={soldOut}
          onClick={() => { add({ productId: product.id, optionId, quantity: qty }); setAdded(true); openDrawer(); }}>
          {soldOut ? "Out of stock" : added ? <><Check size={18} aria-hidden /> Added to cart</> : <><ShoppingBag size={18} aria-hidden /> Add to cart</>}
        </Button>
      </div>
      {added && <p role="status" className="mt-3 text-sm font-medium text-success">Added to your cart. <ButtonLink href="/checkout" variant="ghost" className="ml-1 min-h-0 px-2 py-1">Checkout now</ButtonLink></p>}
    </div>
  );
}
