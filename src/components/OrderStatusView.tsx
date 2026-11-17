"use client";
import { Check } from "lucide-react";
import type { CartLine } from "@/lib/domain/types";
import { useCatalog } from "@/lib/useCatalog";
import { taka } from "@/lib/format";

export interface TrackedOrder {
  reference: string; status: string; createdAt: string; subtotal: number;
  deliveryCharge: number; total: number; lines: CartLine[]; paymentMethod: string;
}

// Mirrors the ERP's sales-order progression. A new web order starts at "Order received"
// (pending confirmation) and only advances when ERP staff confirm and process it.
const STEPS = [
  { key: "pending_confirmation", label: "Order received" }, { key: "confirmed", label: "Confirmed" },
  { key: "processing", label: "Preparing" }, { key: "ready", label: "Packed" },
  { key: "dispatched", label: "Out for delivery" }, { key: "delivered", label: "Delivered" },
];

export function OrderStatusView({ order }: { order: TrackedOrder }) {
  const { products } = useCatalog();
  const stopped = order.status === "cancelled" || order.status === "rejected";
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === order.status));

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl">{order.reference}</h2>
        <p className="text-sm text-ink-soft">{new Date(order.createdAt).toLocaleString("en-GB")}</p>
      </div>
      {stopped ? <p role="status" className="mt-5 rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm font-medium text-danger">{order.status === "rejected" ? "We could not accept this order. Please contact us for help." : "This order was cancelled."}</p> : (
        <ol className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Order progress">
          {STEPS.map((s, n) => (
            <li key={s.key} className="flex items-center gap-2 sm:flex-col sm:items-start" aria-current={n === idx ? "step" : undefined}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${n <= idx ? "bg-brand text-white" : "border border-hairline text-ink-soft"}`}>{n <= idx ? <Check size={14} /> : n + 1}</span>
              <span className={`text-sm ${n <= idx ? "font-medium" : "text-ink-soft"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      <ul className="mt-6 divide-y divide-hairline border-y border-hairline text-sm">
        {order.lines.map((l) => {
          const p = products?.find((x) => x.id === l.productId); const o = p?.options.find((x) => x.id === l.optionId);
          return <li key={l.productId + l.optionId} className="flex justify-between py-2.5"><span>{p?.name ?? "Product"} <span className="text-ink-soft">({o?.label}) × {l.quantity}</span></span><span>{o ? taka(o.price * l.quantity) : ""}</span></li>;
        })}
      </ul>
      <dl className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{taka(order.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Delivery</dt><dd>{order.deliveryCharge ? taka(order.deliveryCharge) : "Free"}</dd></div>
        <div className="flex justify-between pt-2 text-base font-semibold"><dt>Total</dt><dd>{taka(order.total)}</dd></div>
      </dl>
    </div>
  );
}
