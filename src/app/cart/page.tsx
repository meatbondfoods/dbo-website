"use client";
import Image from "next/image";
import Link from "next/link";
import { ShoppingBag, Trash2 } from "lucide-react";
import { useCart, useHydrated } from "@/store/cart";
import { useCatalog } from "@/lib/useCatalog";
import { deliveryNote } from "@/lib/pricing";
import { useCommerce } from "@/lib/useCommerce";
import { taka } from "@/lib/format";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { ButtonLink } from "@/components/ui/Button";

export default function CartPage() {
  const hydrated = useHydrated();
  const { lines, setQty, remove } = useCart();
  const { products, error } = useCatalog();
  const commerce = useCommerce();

  if (!hydrated || (!products && !error)) return <div className="container-page py-20 text-sm text-ink-soft" role="status">Loading your cart…</div>;
  if (error) return <div className="container-page py-20"><p role="alert" className="font-medium text-danger">We couldn&apos;t load product prices. Please refresh the page.</p></div>;

  const rows = lines.flatMap((l) => {
    const p = products!.find((x) => x.id === l.productId); const o = p?.options.find((x) => x.id === l.optionId);
    return p && o ? [{ l, p, o }] : [];
  });

  if (rows.length === 0)
    return (
      <div className="container-page flex flex-col items-center py-24 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-mint-light text-brand"><ShoppingBag size={34} aria-hidden /></span>
        <h1 className="mt-6 text-3xl">Your cart is empty</h1>
        <p className="mt-2 text-ink-soft">Add some fresh cuts and they&apos;ll show up here.</p>
        <ButtonLink href="/shop" className="mt-7 px-8">Browse the shop</ButtonLink>
      </div>
    );

  const subtotal = rows.reduce((n, r) => n + r.o.price * r.l.quantity, 0);

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl sm:text-4xl">Your cart</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="card divide-y divide-hairline px-5">
          {rows.map(({ l, p, o }) => (
            <li key={l.productId + l.optionId} className="flex gap-4 py-5">
              <Link href={`/product/${p.slug}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-hairline"><Image src={p.images[0]} alt={p.name} fill unoptimized className="object-cover" /></Link>
              <div className="flex flex-1 flex-col justify-between gap-3">
                <div className="flex justify-between gap-3">
                  <div><Link href={`/product/${p.slug}`} className="text-base font-semibold text-deep hover:underline">{p.name}</Link><p className="text-sm text-ink-soft">{o.label} · {taka(o.price)} each</p></div>
                  <p className="font-bold">{taka(o.price * l.quantity)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <QuantitySelector value={l.quantity} onChange={(n) => setQty(l.productId, l.optionId, n)} label={`${p.name} ${o.label}`} />
                  <button onClick={() => remove(l.productId, l.optionId)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft hover:bg-mint-light hover:text-danger"><Trash2 size={16} aria-hidden /> Remove</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <aside className="card h-fit p-6 lg:sticky lg:top-32" aria-label="Order summary">
          <h2 className="text-xl">Order summary</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd className="font-medium">{taka(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Delivery</dt><dd className="font-medium">{commerce?.active ? "At checkout" : "To be confirmed"}</dd></div>
            <div className="flex justify-between border-t border-hairline pt-4 text-lg font-bold text-deep"><dt>Total before delivery</dt><dd>{taka(subtotal)}</dd></div>
          </dl>
          {commerce && <p className="mt-4 rounded-lg bg-mint-light p-3 text-xs text-ink">{deliveryNote(commerce)}</p>}
          <ButtonLink href="/checkout" className="mt-6 w-full">Proceed to checkout</ButtonLink>
          <ButtonLink href="/shop" variant="ghost" className="mt-2 w-full">Continue shopping</ButtonLink>
        </aside>
      </div>
    </div>
  );
}
