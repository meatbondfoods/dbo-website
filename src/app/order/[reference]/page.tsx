"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { getLocalOrders } from "@/lib/localOrders";
import { TrackForm } from "@/components/TrackForm";
import { OrderStatusView, type TrackedOrder } from "@/components/OrderStatusView";

export default function OrderPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = use(params);
  const [state, setState] = useState<"loading" | "found" | "ask">("loading");
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  useEffect(() => {
    const phone = getLocalOrders().find((o) => o.reference === reference)?.phone;
    if (!phone) { setState("ask"); return; }
    fetch(`/api/orders/${reference}?phone=${encodeURIComponent(phone)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setOrder(d); setState("found"); })
      .catch(() => setState("ask"));
  }, [reference]);

  return (
    <div className="container-page max-w-3xl py-12">
      {state === "loading" && <p role="status" className="text-sm text-ink-soft">Loading your order…</p>}
      {state === "found" && order && (
        <>
          <div className="mb-8 flex items-start gap-3"><CheckCircle2 className="mt-1 text-brand" aria-hidden />
            <div><h1 className="text-3xl">Thank you, your order is placed</h1><p className="mt-1 text-sm text-ink-soft">We&apos;ll confirm by phone before dispatch. Keep your order number to track delivery.</p></div></div>
          <OrderStatusView order={order} />
          <div className="mt-8 flex gap-3"><Link href="/shop" className="btn-primary">Continue shopping</Link><Link href="/account" className="btn-outline">My orders</Link></div>
        </>
      )}
      {state === "ask" && (<><h1 className="text-3xl">Find your order</h1><p className="mb-8 mt-2 text-sm text-ink-soft">Confirm the mobile number used at checkout to view this order.</p><TrackForm initialReference={reference} /></>)}
    </div>
  );
}
