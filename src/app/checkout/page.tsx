"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart, useHydrated } from "@/store/cart";
import { useCatalog } from "@/lib/useCatalog";
import { priceLines } from "@/lib/pricing";
import { taka } from "@/lib/format";
import { rememberOrder } from "@/lib/localOrders";
import type { PaymentMethod } from "@/lib/domain/types";

const PAY: { id: PaymentMethod; label: string; note: string }[] = [
  { id: "cod", label: "Cash on delivery", note: "Pay when your order arrives" },
  { id: "bkash", label: "bKash", note: "Demo only: no payment is taken" },
  { id: "nagad", label: "Nagad", note: "Demo only: no payment is taken" },
  { id: "card", label: "Card", note: "Demo only: no payment is taken" },
];

export default function CheckoutPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { lines, clear } = useCart();
  const { products } = useCatalog();
  const [pay, setPay] = useState<PaymentMethod>("cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  // One key per checkout attempt: a double-click or retry reuses it, so the server never creates two orders.
  const keyRef = useRef<string>(crypto.randomUUID());

  if (!hydrated || !products) return <div className="container-page py-16 text-sm text-charcoal/60" role="status">Loading…</div>;
  if (lines.length === 0)
    return <div className="container-page py-20 text-center"><h1 className="text-3xl">Nothing to check out</h1><Link href="/shop" className="btn-primary mt-6">Browse the shop</Link></div>;

  let totals: ReturnType<typeof priceLines>;
  try { totals = priceLines(lines, products); } catch (e) {
    return <div className="container-page py-16"><p role="alert">{(e as Error).message}. <Link href="/cart" className="underline">Back to cart</Link></p></div>;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    setBusy(true); setError(""); setFieldErrors({});
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": keyRef.current },
        body: JSON.stringify({
          customer: { name: get("name"), phone: get("phone"), email: get("email") },
          address: { line1: get("line1"), area: get("area"), city: get("city"), notes: get("notes") || undefined },
          paymentMethod: pay, lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.details?.fieldErrors ?? {});
        setError(res.status === 422 && data.details ? "Please check the highlighted details." : data.error ?? "Could not place order.");
        return;
      }
      rememberOrder(data.reference, get("phone"));
      clear();
      router.push(`/order/${data.reference}`);
    } catch { setError("Network problem. Please try again; you won't be charged twice."); }
    finally { setBusy(false); }
  }

  const err = (k: string) => fieldErrors[k]?.[0];
  return (
    <div className="container-page py-10">
      <h1 className="text-4xl">Checkout</h1>
      <form onSubmit={submit} className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]" noValidate>
        <div className="space-y-8">
          <fieldset className="space-y-4"><legend className="font-serif text-xl text-forest">Your details</legend>
            <div><label className="label" htmlFor="name">Full name</label><input id="name" name="name" required autoComplete="name" className="input" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="phone">Mobile number</label><input id="phone" name="phone" required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" aria-invalid={!!err("phone")} className="input" />{err("phone") && <p className="mt-1 text-xs text-clay">{err("phone")}</p>}</div>
              <div><label className="label" htmlFor="email">Email (optional)</label><input id="email" name="email" type="email" autoComplete="email" className="input" /></div>
            </div>
          </fieldset>
          <fieldset className="space-y-4"><legend className="font-serif text-xl text-forest">Delivery address</legend>
            <div><label className="label" htmlFor="line1">Address</label><input id="line1" name="line1" required autoComplete="street-address" placeholder="House, road, block" className="input" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="area">Area</label><input id="area" name="area" required className="input" /></div>
              <div><label className="label" htmlFor="city">City</label><input id="city" name="city" required defaultValue="Dhaka" className="input" /></div>
            </div>
            <div><label className="label" htmlFor="notes">Delivery notes (optional)</label><textarea id="notes" name="notes" rows={2} className="input" /></div>
          </fieldset>
          <fieldset><legend className="font-serif text-xl text-forest">Payment method</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {PAY.map((m) => (
                <label key={m.id} className={`cursor-pointer rounded-md border p-4 text-sm ${pay === m.id ? "border-forest bg-forest-tint" : "border-line bg-white"}`}>
                  <input type="radio" name="pay" className="sr-only" checked={pay === m.id} onChange={() => setPay(m.id)} />
                  <span className="block font-medium">{m.label}</span><span className="text-xs text-charcoal/60">{m.note}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="h-fit rounded-md border border-line bg-white p-6" aria-label="Order summary">
          <h2 className="text-xl">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {lines.map((l) => { const p = products.find((x) => x.id === l.productId)!; const o = p.options.find((x) => x.id === l.optionId)!;
              return <li key={l.productId + l.optionId} className="flex justify-between gap-3"><span>{p.name} <span className="text-charcoal/55">({o.label}) × {l.quantity}</span></span><span>{taka(o.price * l.quantity)}</span></li>; })}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{taka(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Delivery</dt><dd>{totals.deliveryCharge === 0 ? "Free" : taka(totals.deliveryCharge)}</dd></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>Total</dt><dd>{taka(totals.total)}</dd></div>
          </dl>
          {error && <p role="alert" className="mt-4 rounded-md bg-clay/10 p-3 text-sm text-clay">{error}</p>}
          <button className="btn-primary mt-5 w-full" disabled={busy}>{busy ? "Placing order…" : "Place order"}</button>
          <p className="mt-3 text-xs text-charcoal/55">Prices are re-checked by our server when you place the order.</p>
        </aside>
      </form>
    </div>
  );
}
