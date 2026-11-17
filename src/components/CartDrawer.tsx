"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/store/cart";
import { useUI } from "@/store/ui";
import { useCatalog } from "@/lib/useCatalog";
import { deliverySummary } from "@/lib/pricing";
import { useCommerce } from "@/lib/useCommerce";
import { taka } from "@/lib/format";
import { QuantitySelector } from "./ui/QuantitySelector";
import { ButtonLink } from "./ui/Button";

export function CartDrawer() {
  const open = useUI((s) => s.drawerOpen);
  const close = useUI((s) => s.closeDrawer);
  const { lines, setQty, remove } = useCart();
  const { products } = useCatalog();
  const commerce = useCommerce();
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !panelRef.current) return; // keep keyboard focus inside the dialog
      const f = panelRef.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled])");
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; prev?.focus(); };
  }, [open, close]);

  if (!open) return null;

  const rows = lines.flatMap((l) => {
    const p = products?.find((x) => x.id === l.productId); const o = p?.options.find((x) => x.id === l.optionId);
    return p && o ? [{ l, p, o }] : [];
  });
  const subtotal = rows.reduce((n, r) => n + r.o.price * r.l.quantity, 0);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 animate-fade-in bg-deep/50" onClick={close} aria-hidden />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label="Shopping cart" className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in flex-col bg-white shadow-lift">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="text-xl">Your cart</h2>
          <button ref={closeRef} onClick={close} aria-label="Close cart" className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-mint-light"><X size={20} aria-hidden /></button>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mint-light text-brand"><ShoppingBag size={28} aria-hidden /></span>
            <p className="mt-4 text-lg font-bold text-deep">Your cart is empty</p>
            <p className="mt-1 text-sm text-ink-soft">Add something fresh and it will appear here.</p>
            <ButtonLink href="/shop" onClick={close} className="mt-6">Browse the shop</ButtonLink>
          </div>
        ) : (
          <>
            <div className="border-b border-hairline bg-mint-light px-5 py-3 text-sm text-ink">{commerce ? deliverySummary(commerce) + ". Delivery is calculated at checkout." : "Delivery is calculated at checkout."}</div>
            <ul className="flex-1 divide-y divide-hairline overflow-y-auto px-5">
              {rows.map(({ l, p, o }) => (
                <li key={l.productId + l.optionId} className="flex gap-3 py-4">
                  <Link href={`/product/${p.slug}`} onClick={close} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-hairline"><Image src={p.images[0]} alt={p.name} fill unoptimized className="object-cover" /></Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0"><Link href={`/product/${p.slug}`} onClick={close} className="line-clamp-2 text-sm font-semibold text-deep hover:underline">{p.name}</Link><p className="text-xs text-ink-soft">{o.label} · {taka(o.price)}</p></div>
                      <p className="text-sm font-bold">{taka(o.price * l.quantity)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <QuantitySelector size="sm" value={l.quantity} onChange={(n) => setQty(l.productId, l.optionId, n)} label={`${p.name} ${o.label}`} />
                      <button onClick={() => remove(l.productId, l.optionId)} aria-label={`Remove ${p.name} ${o.label}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft hover:bg-mint-light hover:text-danger"><Trash2 size={16} aria-hidden /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-hairline px-5 py-4">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{taka(subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Delivery</dt><dd>At checkout</dd></div>
                <div className="flex justify-between pt-2 text-base font-bold text-deep"><dt>Total before delivery</dt><dd>{taka(subtotal)}</dd></div>
              </dl>
              <div className="mt-4 grid gap-2">
                <ButtonLink href="/checkout" onClick={close}>Checkout</ButtonLink>
                <ButtonLink href="/cart" variant="outline" onClick={close}>View full cart</ButtonLink>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
