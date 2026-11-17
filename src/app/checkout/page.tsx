"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, useHydrated } from "@/store/cart";
import { useCatalog } from "@/lib/useCatalog";
import { areaDistance, deliveryCharge, priceLines } from "@/lib/pricing";
import { useCommerce } from "@/lib/useCommerce";
import { taka } from "@/lib/format";
import { rememberOrder } from "@/lib/localOrders";
import type { PaymentMethod } from "@/lib/domain/types";
import { Field, TextArea, TextInput } from "@/components/ui/FormControls";
import { Button, ButtonLink } from "@/components/ui/Button";

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
  const commerce = useCommerce();
  const [area, setArea] = useState("");
  const [pay, setPay] = useState<PaymentMethod>("cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fe, setFe] = useState<Record<string, string[]>>({});
  // One key per checkout attempt: a double-click or retry reuses it, so the server never creates two orders.
  const keyRef = useRef<string>(crypto.randomUUID());

  if (!hydrated || !products || !commerce) return <div className="container-page py-20 text-sm text-ink-soft" role="status">Loading checkout…</div>;
  if (lines.length === 0)
    return <div className="container-page flex flex-col items-center py-24 text-center"><h1 className="text-3xl">Nothing to check out</h1><p className="mt-2 text-ink-soft">Your cart is empty.</p><ButtonLink href="/shop" className="mt-7 px-8">Browse the shop</ButtonLink></div>;

  let totals: { subtotal: number; deliveryCharge: number; total: number };
  try {
    const { subtotal } = priceLines(lines, products);
    // Same rule the server applies (the server is authoritative and recomputes from the area name).
    const charge = deliveryCharge(subtotal, area ? areaDistance(area, commerce) : null, commerce);
    totals = { subtotal, deliveryCharge: charge, total: subtotal + charge };
  } catch (e) {
    return <div className="container-page py-20"><p role="alert" className="font-medium text-danger">{(e as Error).message}.</p><ButtonLink href="/cart" variant="outline" className="mt-5">Back to cart</ButtonLink></div>;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "");
    if (!area) { setError("Please choose your delivery area."); return; }
    setBusy(true); setError(""); setFe({});
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": keyRef.current },
        body: JSON.stringify({
          customer: { name: get("name"), phone: get("phone"), email: get("email") },
          address: { line1: get("line1"), area, city: get("city"), notes: get("notes") || undefined },
          paymentMethod: pay, lines,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const d = data.details?.fieldErrors ?? {};
        // The API nests customer/address errors; flatten to the form's field names.
        setFe({ name: d.customer, phone: d.customer, line1: d.address, area: d.address, city: d.address });
        setError(res.status === 422 && data.details ? "Please check your details and try again." : data.error ?? "Could not place your order.");
        return;
      }
      rememberOrder(data.reference, get("phone"));
      clear();
      router.push(`/order/${data.reference}`);
    } catch { setError("Network problem. Please try again; you won't be charged twice."); }
    finally { setBusy(false); }
  }

  const sec = "card space-y-4 p-6";
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl sm:text-4xl">Checkout</h1>
      <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]" noValidate>
        <div className="space-y-6">
          <fieldset className={sec}><legend className="mb-1 text-lg font-bold text-deep">1. Your details</legend>
            <TextInput label="Full name" name="name" required autoComplete="name" error={fe.name?.[0] && "Please enter your full name"} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Mobile number" name="phone" required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" hint="We call to confirm your order." error={fe.phone?.[0] && "Enter a valid Bangladesh mobile number"} />
              <TextInput label="Email (optional)" name="email" type="email" autoComplete="email" />
            </div>
          </fieldset>
          <fieldset className={sec}><legend className="mb-1 text-lg font-bold text-deep">2. Delivery address</legend>
            <TextInput label="Address" name="line1" required autoComplete="street-address" placeholder="House, road, block" error={fe.line1?.[0] && "Please enter your street address"} />
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Area" hint={`Free delivery within ${commerce.freeRadiusKm} km`}>{({ id, describedBy }) => (<select id={id} aria-describedby={describedBy} required value={area} onChange={(e) => setArea(e.target.value)} className="input"><option value="">Choose your area</option>{commerce.areas.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}<option value="Other area">Other area</option></select>)}</Field><TextInput label="City" name="city" required defaultValue="Dhaka" /></div>
            <TextArea label="Delivery notes (optional)" name="notes" rows={2} />
          </fieldset>
          <fieldset className={sec}><legend className="mb-1 text-lg font-bold text-deep">3. Payment method</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {PAY.map((m) => (
                <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-sm transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf ${pay === m.id ? "border-brand bg-mint-light" : "border-hairline bg-white hover:border-ink-soft"}`}>
                  <input type="radio" name="pay" className="mt-0.5 h-4 w-4 accent-brand" checked={pay === m.id} onChange={() => setPay(m.id)} />
                  <span><span className="block font-semibold text-deep">{m.label}</span><span className="text-xs text-ink-soft">{m.note}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-32" aria-label="Order summary">
          <h2 className="text-xl">Order summary</h2>
          <ul className="mt-5 space-y-3 text-sm">
            {lines.map((l) => { const p = products.find((x) => x.id === l.productId)!; const o = p.options.find((x) => x.id === l.optionId)!;
              return <li key={l.productId + l.optionId} className="flex justify-between gap-3"><span>{p.name}<span className="block text-xs text-ink-soft">{o.label} × {l.quantity}</span></span><span className="font-medium">{taka(o.price * l.quantity)}</span></li>; })}
          </ul>
          <dl className="mt-5 space-y-2.5 border-t border-hairline pt-5 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{taka(totals.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Delivery</dt><dd>{!area ? "Choose your area" : totals.deliveryCharge === 0 ? "Free" : taka(totals.deliveryCharge)}</dd></div>
            <div className="flex justify-between border-t border-hairline pt-3 text-lg font-bold text-deep"><dt>Total</dt><dd>{taka(totals.total)}</dd></div>
          </dl>
          {error && <p role="alert" className="mt-5 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm font-medium text-danger">{error}</p>}
          <Button className="mt-6 w-full" disabled={busy}>{busy ? "Placing order…" : `Place order · ${taka(totals.total)}`}</Button>
          <p className="mt-3 text-center text-xs text-ink-soft">Prices are re-checked by our server when you place the order.</p>
        </aside>
      </form>
    </div>
  );
}
