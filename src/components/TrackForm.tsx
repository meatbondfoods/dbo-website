"use client";
import { useState } from "react";
import { OrderStatusView, type TrackedOrder } from "./OrderStatusView";
import { rememberOrder } from "@/lib/localOrders";

export function TrackForm({ initialReference = "", initialPhone = "" }: { initialReference?: string; initialPhone?: string }) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function lookup(reference: string, phone: string) {
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference.trim())}?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (!res.ok) { setOrder(null); setError(res.status === 404 ? "We couldn't find an order with those details." : data.error ?? "Something went wrong."); return; }
      setOrder(data); rememberOrder(data.reference, phone.trim());
    } catch { setError("Network problem. Please try again."); } finally { setBusy(false); }
  }

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); lookup(String(f.get("ref")), String(f.get("phone"))); }} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div><label htmlFor="ref" className="label">Order number</label><input id="ref" name="ref" required defaultValue={initialReference} placeholder="MM-2026-0001" className="input" /></div>
        <div><label htmlFor="tp" className="label">Mobile number</label><input id="tp" name="phone" required defaultValue={initialPhone} inputMode="tel" placeholder="01XXXXXXXXX" className="input" /></div>
        <button className="btn-primary" disabled={busy}>{busy ? "Searching…" : "Track order"}</button>
      </form>
      {error && <p role="alert" className="mt-4 text-sm text-clay">{error}</p>}
      {order && <div className="mt-8"><OrderStatusView order={order} /></div>}
    </div>
  );
}
