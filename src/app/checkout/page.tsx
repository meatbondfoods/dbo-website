"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, useHydrated } from "@/store/cart";
import { useCatalog } from "@/lib/useCatalog";
import { areaDistance, deliveryCharge, priceLines } from "@/lib/pricing";
import { useCommerce } from "@/lib/useCommerce";
import { taka } from "@/lib/format";
import { rememberOrder } from "@/lib/localOrders";
import { haversineKm } from "@/lib/geocode";
import type { PaymentMethod } from "@/lib/domain/types";
import { Field, TextArea, TextInput } from "@/components/ui/FormControls";
import { Button, ButtonLink } from "@/components/ui/Button";
import { trackInitiateCheckout, trackPurchase } from "@/lib/meta-pixel";
import { MapPin, Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

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
  const [city, setCity] = useState("Chattagram");
  const [me, setMe] = useState<{ fullName: string; phone: string; email: string } | null>(null);
  const [saved, setSaved] = useState<{ id: string; fullName: string; phone: string; line1: string; area: string; city: string; instructions: string }[]>([]);
  const [pre, setPre] = useState<{ n: number; fullName?: string; phone?: string; line1?: string; city?: string; notes?: string }>({ n: 0 });
  // Signed-in customers get their details and saved addresses (401 = guest, which is fine).
  useEffect(() => {
    fetch("/api/account/profile").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.profile) { setMe(d.profile); setPre((p) => ({ n: p.n + 1, fullName: d.profile.fullName, phone: d.profile.phone })); } });
    fetch("/api/account/addresses").then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.addresses) setSaved(d.addresses); });
  }, []);
  const [pay, setPay] = useState<PaymentMethod>("cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fe, setFe] = useState<Record<string, string[]>>({});
  const [locating, setLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<{
    type: "success" | "warning" | "error";
    message: string;
    mapsUrl?: string;
    isDeliverable?: boolean;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // One key per checkout attempt: a double-click or retry reuses it, so the server never creates two orders.
  const keyRef = useRef<string>(crypto.randomUUID());
  const checkoutTrackedRef = useRef(false);

  const detectLocation = async () => {
    setLocating(true);
    setLocationStatus(null);

    const getCoords = async (): Promise<{ lat: number; lon: number; source: "gps" | "network" }> => {
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        // Pass 1: High Accuracy GPS / Wi-Fi Triangulation FIRST (6.5s timeout, maximumAge: 0)
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6500,
              maximumAge: 0,
            });
          });
          return { lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" };
        } catch (err: any) {
          // If high accuracy times out or fails (e.g. PC without Wi-Fi), try quick coarse pass
        }

        // Pass 2: Quick fallback with low accuracy (2.5s timeout)
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 2500,
              maximumAge: 10000,
            });
          });
          return { lat: pos.coords.latitude, lon: pos.coords.longitude, source: "gps" };
        } catch (err: any) {
          // Fall through to Pass 3 network fallback
        }
      }

      // Pass 3: Automatic Network / IP Location fallback
      const ipRes = await fetch("/api/geocode").catch(() => null);
      if (ipRes && ipRes.ok) {
        const ipData = await ipRes.json().catch(() => null);
        if (ipData?.latitude && ipData?.longitude) {
          return { lat: ipData.latitude, lon: ipData.longitude, source: "network" };
        }
      }

      return { lat: 22.3811, lon: 91.8482, source: "network" };
    };

    try {
      const coords = await getCoords();
      const res = await fetch(`/api/geocode?lat=${coords.lat}&lon=${coords.lon}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Could not resolve address");
      }

      let matchedArea = data.area;
      if (commerce?.areas && commerce.areas.length > 0) {
        const found = commerce.areas.find(
          (a) =>
            a.name.toLowerCase().includes(data.area.toLowerCase()) ||
            data.area.toLowerCase().includes(a.name.toLowerCase())
        );
        if (found) matchedArea = found.name;
      }
      setArea(matchedArea);

      const formEl = formRef.current;
      const existingLine1 = (formEl?.elements.namedItem("line1") as HTMLInputElement)?.value || pre.line1 || "";
      const existingNotes = (formEl?.elements.namedItem("notes") as HTMLTextAreaElement)?.value || pre.notes || "";

      let finalLine1 = data.line1;
      if (existingLine1 && !existingLine1.includes(data.line1)) {
        finalLine1 = `${existingLine1}, ${data.line1}`;
      }

      const cleanNotes = existingNotes.replace(/\n?📍 GPS Pin:.*$/g, "").trim();
      const finalNotes = cleanNotes
        ? `${cleanNotes}\n📍 GPS Pin: ${data.mapsUrl}`
        : `📍 GPS Pin: ${data.mapsUrl}`;

      const detectedCity = data.city || "Chattagram";
      setCity(detectedCity);

      const isLocDeliverable =
        data.isDeliverable ??
        ((detectedCity.toLowerCase() === "chattagram" ||
          detectedCity.toLowerCase() === "chittagong" ||
          detectedCity.toLowerCase().includes("chatt")) &&
          (data.distanceKm ?? 0) <= 35);

      setPre((p) => ({
        ...p,
        n: p.n + 1,
        line1: finalLine1,
        city: detectedCity,
        notes: finalNotes,
      }));

      if (!isLocDeliverable) {
        setLocationStatus({
          type: "warning",
          message: `📍 ${matchedArea}, ${detectedCity} — Currently, delivery is not available in this area.`,
          mapsUrl: data.mapsUrl,
          isDeliverable: false,
        });
      } else {
        const feeNote = data.isFreeDelivery ? "Free delivery (within 7 km)" : "Delivery: ৳80";
        setLocationStatus({
          type: "success",
          message: `📍 ${matchedArea}, ${detectedCity} — ${feeNote}${coords.source === "network" ? " (via network)" : ""}`,
          mapsUrl: data.mapsUrl,
          isDeliverable: true,
        });
      }
    } catch (err: any) {
      let msg = "Device location unavailable. Please select your area or enter address manually.";
      if (err?.code === 1) {
        msg = "Location permission is blocked in your browser. Please allow location access or select your area below.";
      }
      setLocationStatus({
        type: "error",
        message: msg,
      });
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (checkoutTrackedRef.current || !products || lines.length === 0) return;
    checkoutTrackedRef.current = true;
    const items = lines.flatMap((l) => {
      const p = products.find((x) => x.id === l.productId);
      const o = p?.options.find((x) => x.id === l.optionId);
      return p && o ? [{ id: p.id, name: p.name, price: o.price, quantity: l.quantity }] : [];
    });
    const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    trackInitiateCheckout({ items, subtotal, currency: "BDT" });
  }, [products, lines]);

  if (!hydrated || !products || !commerce) return <div className="container-page py-20 text-sm text-ink-soft" role="status">Loading checkout…</div>;
  if (lines.length === 0)
    return <div className="container-page flex flex-col items-center py-24 text-center"><h1 className="text-3xl">Nothing to check out</h1><p className="mt-2 text-ink-soft">Your cart is empty.</p><ButtonLink href="/shop" className="mt-7 px-8">Browse the shop</ButtonLink></div>;

  let totals: { subtotal: number; deliveryCharge: number; total: number };
  const isCityCtg =
    !city ||
    city.trim().toLowerCase() === "chattagram" ||
    city.trim().toLowerCase() === "chittagong" ||
    city.trim().toLowerCase().includes("chatt") ||
    city.trim().toLowerCase().includes("chitt");
  const isDeliverable = isCityCtg && locationStatus?.isDeliverable !== false;

  try {
    const { subtotal } = priceLines(lines, products);
    // Same rule the server applies (the server is authoritative and recomputes from the area name).
    const charge = isDeliverable ? deliveryCharge(subtotal, area ? areaDistance(area, commerce) : null, commerce) : 0;
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
    if (!isDeliverable) {
      setError("Currently, delivery is not available for this location. We deliver exclusively within Chattagram.");
      return;
    }
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

      const purchaseItems = lines.flatMap((l) => {
        const p = (products ?? []).find((x) => x.id === l.productId);
        const o = p?.options.find((x) => x.id === l.optionId);
        return p && o ? [{ id: p.id, name: p.name, price: o.price, quantity: l.quantity }] : [];
      });

      trackPurchase({
        reference: data.reference,
        total: data.total,
        items: purchaseItems,
        currency: "BDT",
      });

      if (me && f.get("saveAddress") === "on") {
        fetch("/api/account/addresses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fullName: get("name"),
            phone: get("phone"),
            line1: get("line1"),
            area,
            city: get("city"),
            instructions: (get("notes") || "").slice(0, 300),
            isDefault: saved.length === 0,
          }),
        }).catch(() => {});
      }

      clear();
      router.push(`/order/${data.reference}`);
    } catch { setError("Network problem. Please try again; you won't be charged twice."); }
    finally { setBusy(false); }
  }

  const sec = "card space-y-4 p-6";
  return (
    <div className="container-page py-10">
      <h1 className="text-3xl sm:text-4xl">Checkout</h1>
      <form ref={formRef} onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]" noValidate>
        <div className="space-y-6">
          <fieldset key={pre.n} className={sec}><legend className="mb-1 text-lg font-bold text-deep">1. Your details</legend>
            {me ? <p className="text-sm text-ink-soft">Signed in as <strong>{me.email}</strong>. This order will appear in your order history.</p> : <p className="text-sm text-ink-soft">Checking out as a guest. <Link href="/login?next=/checkout" className="font-semibold text-brand underline">Sign in</Link> to use saved details and track orders in your account.</p>}
            <TextInput label="Full name" name="name" required autoComplete="name" defaultValue={pre.fullName} error={fe.name?.[0] && "Please enter your full name"} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Mobile number" name="phone" required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" defaultValue={pre.phone} hint="We call to confirm your order." error={fe.phone?.[0] && "Enter a valid Bangladesh mobile number"} />
              <TextInput label="Email (optional)" name="email" type="email" autoComplete="email" defaultValue={me?.email} />
            </div>
          </fieldset>
          <fieldset key={`a${pre.n}`} className={sec}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-hairline/60 pb-3">
              <div>
                <legend className="text-lg font-bold text-deep">2. Delivery address</legend>
                <p className="text-xs text-ink-soft">Enter where you want your order delivered</p>
              </div>
              <button
                type="button"
                onClick={detectLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-brand/30 bg-mint-light/70 px-3 py-2 text-xs font-semibold text-brand transition-all hover:bg-mint-light hover:border-brand disabled:opacity-60 cursor-pointer shadow-sm"
                title="Auto-fill address using your device GPS (Daraz style)"
              >
                {locating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    <span>Detecting location…</span>
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 text-brand" />
                    <span>Use Current Location (Daraz style)</span>
                  </>
                )}
              </button>
            </div>

            {locating && (
              <div className="flex items-center gap-2 rounded-lg border border-brand/20 bg-mint-light/40 p-3 text-xs text-brand animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Accessing GPS and finding nearest Chattagram street & area…</span>
              </div>
            )}

            {locationStatus && (
              <div
                role="status"
                className={`flex items-start justify-between gap-2 rounded-lg border p-3 text-xs ${
                  locationStatus.type === "success"
                    ? "border-brand/30 bg-mint-light text-deep"
                    : locationStatus.type === "warning"
                    ? "border-amber-300 bg-amber-50 text-amber-900"
                    : "border-danger/30 bg-danger/5 text-danger"
                }`}
              >
                <div className="flex items-start gap-2">
                  {locationStatus.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand mt-0.5" />
                  ) : locationStatus.type === "warning" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 text-danger mt-0.5" />
                  )}
                  <span className="leading-relaxed">{locationStatus.message}</span>
                </div>
                {locationStatus.mapsUrl && (
                  <a
                    href={locationStatus.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`shrink-0 font-semibold underline inline-flex items-center gap-1 ${
                      locationStatus.type === "warning" ? "text-amber-800" : "text-brand"
                    }`}
                  >
                    View pin <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {!isDeliverable && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="font-medium">
                  Currently, delivery is not available in this area.
                </span>
              </div>
            )}

            {saved.length > 0 && (
              <Field label="Use a saved address">
                {({ id }) => (
                  <select
                    id={id}
                    className="input"
                    defaultValue=""
                    onChange={(e) => {
                      const s = saved.find((x) => x.id === e.target.value);
                      if (s) {
                        setArea(s.area);
                        const sCity = s.city || "Chattagram";
                        setCity(sCity);
                        const isCtg = sCity.toLowerCase() === "chattagram" || sCity.toLowerCase() === "chittagong" || sCity.toLowerCase().includes("chatt");
                        if (!isCtg) {
                          setLocationStatus({
                            type: "warning",
                            message: `📍 ${s.area}, ${sCity} — Currently, delivery is not available in this area.`,
                            isDeliverable: false,
                          });
                        } else {
                          setLocationStatus(null);
                        }
                        setPre((p) => ({
                          n: p.n + 1,
                          fullName: s.fullName,
                          phone: s.phone,
                          line1: s.line1,
                          city: sCity,
                          notes: s.instructions,
                        }));
                      }
                    }}
                  >
                    <option value="">Choose a saved address</option>
                    {saved.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}, {s.line1}, {s.area} ({s.city})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
            <TextInput label="Address" name="line1" required autoComplete="street-address" placeholder="House, road, block" defaultValue={pre.line1} error={fe.line1?.[0] && "Please enter your street address"} />
            <div className="grid gap-4 sm:grid-cols-2">
              {commerce.active && commerce.areas.length > 0 ? (
                <Field label="Area" hint="Choose your delivery area">
                  {({ id, describedBy }) => (
                    <select
                      id={id}
                      aria-describedby={describedBy}
                      required
                      value={area}
                      onChange={(e) => {
                        const val = e.target.value;
                        setArea(val);
                        if (val && val !== "Other area") {
                          setCity("Chattagram");
                          if (locationStatus?.isDeliverable === false) {
                            setLocationStatus(null);
                          }
                        }
                      }}
                      className="input"
                    >
                      <option value="">Choose your area</option>
                      {commerce.areas.map((a) => (
                        <option key={a.name} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                      <option value="Other area">Other area</option>
                    </select>
                  )}
                </Field>
              ) : (
                <TextInput
                  label="Area"
                  name="areaText"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              )}
              <TextInput
                label="City"
                name="city"
                required
                value={city}
                onChange={(e) => {
                  const val = e.target.value;
                  setCity(val);
                  const isCtg =
                    val.trim().toLowerCase() === "chattagram" ||
                    val.trim().toLowerCase() === "chittagong" ||
                    val.trim().toLowerCase().includes("chatt");
                  if (!isCtg) {
                    setLocationStatus({
                      type: "warning",
                      message: `Currently, delivery is not available for ${val}. MeatBond Foods delivers exclusively within Chattagram.`,
                      isDeliverable: false,
                    });
                  } else if (locationStatus?.isDeliverable === false) {
                    setLocationStatus(null);
                  }
                }}
              />
            </div>
            <TextArea label="Delivery notes (optional)" name="notes" rows={2} defaultValue={pre.notes} />
            {me && (
              <label className="flex items-center gap-2 text-xs font-medium text-deep cursor-pointer pt-1">
                <input
                  type="checkbox"
                  name="saveAddress"
                  defaultChecked
                  className="h-4 w-4 accent-brand rounded"
                />
                Save this delivery address to my account for future orders
              </label>
            )}
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
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{taka(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Delivery</dt>
              <dd className={!isDeliverable ? "text-amber-700 font-semibold text-xs" : ""}>
                {!isDeliverable
                  ? "Currently unavailable"
                  : !commerce.active
                  ? "To be confirmed"
                  : !area
                  ? "Choose your area"
                  : totals.deliveryCharge === 0
                  ? "Free"
                  : taka(totals.deliveryCharge)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-hairline pt-3 text-lg font-bold text-deep">
              <dt>{!isDeliverable ? "Subtotal" : commerce.active ? "Total" : "Total (excluding delivery)"}</dt>
              <dd>{!isDeliverable ? taka(totals.subtotal) : taka(totals.total)}</dd>
            </div>
          </dl>
          {error && <p role="alert" className="mt-5 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm font-medium text-danger">{error}</p>}
          <Button className="mt-6 w-full" disabled={busy || !isDeliverable}>
            {busy
              ? "Placing order…"
              : !isDeliverable
              ? "Delivery currently unavailable"
              : `Place order · ${taka(totals.total)}`}
          </Button>
          {!isDeliverable && (
            <p className="mt-2 text-center text-xs text-amber-700 font-medium">
              Currently, delivery is not available in this area (available in Chattagram only).
            </p>
          )}
          <p className="mt-3 text-center text-xs text-ink-soft">Prices are re-checked by our server when you place the order.{!commerce.active && " Our team will confirm your delivery charge when confirming your order."}</p>
        </aside>
      </form>
    </div>
  );
}
