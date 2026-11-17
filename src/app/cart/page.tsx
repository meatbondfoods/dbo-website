"use client";
import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart, useHydrated } from "@/store/cart";
import { useCatalog } from "@/lib/useCatalog";
import { DELIVERY_CHARGE, FREE_DELIVERY_THRESHOLD } from "@/lib/pricing";
import { taka } from "@/lib/format";

export default function CartPage() {
  const hydrated = useHydrated();
  const { lines, setQty, remove } = useCart();
  const { products, error } = useCatalog();

  if (!hydrated || (!products && !error)) return <div className="container-page py-16 text-sm text-charcoal/60" role="status">Loading your cart…</div>;
  if (error) return <div className="container-page py-16"><p role="alert">We couldn&apos;t load product prices. Please refresh.</p></div>;

  const rows = lines.flatMap((l) => {
    const p = products!.find((x) => x.id === l.productId);
    const o = p?.options.find((x) => x.id === l.optionId);
    return p && o ? [{ l, p, o }] : [];
  });

  if (rows.length === 0)
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-3xl">Your cart is empty</h1>
        <p className="mt-3 text-sm text-charcoal/65">Add some fresh cuts and they&apos;ll show up here.</p>
        <Link href="/shop" className="btn-primary mt-6">Browse the shop</Link>
      </div>
    );

  const subtotal = rows.reduce((n, r) => n + r.o.price * r.l.quantity, 0);
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;

  return (
    <div className="container-page py-10">
      <h1 className="text-4xl">Your cart</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_340px]">
        <ul className="divide-y divide-line border-y border-line">
          {rows.map(({ l, p, o }) => (
            <li key={`${l.productId}-${l.optionId}`} className="flex gap-4 py-5">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-line"><Image src={p.images[0]} alt={p.name} fill unoptimized className="object-cover" /></div>
              <div className="flex flex-1 flex-col justify-between">
                <div className="flex justify-between gap-3">
                  <div><Link href={`/product/${p.slug}`} className="font-serif text-lg hover:text-forest">{p.name}</Link><p className="text-sm text-charcoal/60">{o.label} · {taka(o.price)}</p></div>
                  <p className="font-semibold">{taka(o.price * l.quantity)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center rounded-md border border-line bg-white" role="group" aria-label={`Quantity for ${p.name}`}>
                    <button aria-label="Decrease quantity" className="p-2 disabled:opacity-40" disabled={l.quantity <= 1} onClick={() => setQty(l.productId, l.optionId, l.quantity - 1)}><Minus size={14} /></button>
                    <span className="w-8 text-center text-sm">{l.quantity}</span>
                    <button aria-label="Increase quantity" className="p-2 disabled:opacity-40" disabled={l.quantity >= 50} onClick={() => setQty(l.productId, l.optionId, l.quantity + 1)}><Plus size={14} /></button>
                  </div>
                  <button onClick={() => remove(l.productId, l.optionId)} className="inline-flex items-center gap-1 text-sm text-charcoal/60 hover:text-clay"><Trash2 size={14} /> Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="h-fit rounded-md border border-line bg-white p-6" aria-label="Order summary">
          <h2 className="text-xl">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{taka(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Delivery</dt><dd>{delivery === 0 ? "Free" : taka(delivery)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd>{taka(subtotal + delivery)}</dd></div>
          </dl>
          {delivery > 0 && <p className="mt-3 text-xs text-charcoal/60">Add {taka(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery.</p>}
          <Link href="/checkout" className="btn-primary mt-5 w-full">Checkout</Link>
        </aside>
      </div>
    </div>
  );
}
