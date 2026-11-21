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
    const localPhone = getLocalOrders().find((o) => o.reference === reference)?.phone;
    const url = localPhone ? `/api/orders/${reference}?phone=${encodeURIComponent(localPhone)}` : `/api/orders/${reference}`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setOrder(d); setState("found"); })
      .catch(() => setState("ask"));
  }, [reference]);

  return (
    <div className="container-page max-w-3xl py-12">
      {state === "loading" && <p role="status" className="text-sm text-ink-soft">Loading your order…</p>}
      {state === "found" && order && (
        <>
          <div className="mb-8 flex items-start gap-3">
            <CheckCircle2 className="mt-1 text-brand" aria-hidden />
            <div>
              <h1 className="text-3xl">
                {order.status === "confirmed" ? "Order Confirmed" : "We’ve received your order"}
              </h1>
              <p className="mt-1 text-sm text-ink-soft">
                {order.status === "confirmed"
                  ? (order.deliveryDate
                      ? `Your order has been confirmed! Delivery is scheduled for ${new Date(order.deliveryDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}.`
                      : "Your order has been confirmed by our team and is scheduled for dispatch.")
                  : "It is now pending confirmation by our team. We’ll confirm before dispatch. Keep your order number to track it."}
              </p>
            </div>
          </div>
          <OrderStatusView order={order} />
          <div className="mt-8 flex gap-3"><Link href="/shop" className="btn-primary">Continue shopping</Link><Link href="/account" className="btn-outline">My orders</Link></div>
        </>
      )}
      {state === "ask" && (
        <>
          <h1 className="text-3xl">Find your order</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Confirm the mobile number used at checkout to view this order.
          </p>
          <div className="my-5 p-4 rounded-xl bg-mint-light/60 border border-hairline flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-deep font-medium">Logged in to your account? View all your orders directly without entering any order numbers:</span>
            <Link href="/account/orders" className="btn-primary text-xs py-2 px-4 whitespace-nowrap">
              View My Orders
            </Link>
          </div>
          <TrackForm initialReference={reference} />
        </>
      )}
    </div>
  );
}
