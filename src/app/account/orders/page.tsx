import Link from "next/link";
import { requireUser } from "@/lib/auth/page";
import { getRepositories } from "@/lib/repositories";
import { taka } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Order history" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await getRepositories().orders.listForCustomer(user.customerId, user.phone, user.email);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl">My Orders</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Live situation and tracking for all orders under your account.
          </p>
        </div>
        <Link href="/shop" className="btn-primary text-sm py-2 px-4">
          + Start Shopping
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-ink-soft/40 bg-white p-10 text-center">
          <p className="font-bold text-deep text-lg">No orders yet</p>
          <p className="mt-1 text-sm text-ink-soft">
            When you place an order while signed in, it will appear here with live tracking.
          </p>
          <Link href="/shop" className="btn-primary mt-5">
            Start shopping
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/account/orders/${o.reference}`}
                className="card block p-5 transition-all hover:border-brand hover:shadow-lift"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-deep text-lg">{o.reference}</span>
                      <StatusBadge status={o.status} />
                    </div>
                    <p className="text-xs text-ink-soft mt-1">
                      Ordered on {new Date(o.createdAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} · {o.input.lines.reduce((n, l) => n + l.quantity, 0)} item(s)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-lg text-deep">{taka(o.total)}</span>
                    <span className="text-xs text-ink-soft">
                      {o.input.paymentMethod === "cod" ? "Cash on delivery" : o.input.paymentMethod} · {o.paymentStatus === "paid" ? "Paid" : "Pay on delivery"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-hairline flex flex-wrap items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-soft">Current situation:</span>
                    <span className="font-semibold text-deep capitalize">
                      {o.status === "pending_confirmation" ? "Order received (Awaiting review)" :
                       o.status === "confirmed" ? "Order Confirmed" :
                       o.status === "processing" ? "In Processing / Cutting" :
                       o.status === "ready" ? "Ready for Dispatch" :
                       o.status === "dispatched" ? "Out for Delivery" :
                       o.status === "delivered" ? "Delivered" : o.status}
                    </span>
                  </div>
                  {o.deliveryDate ? (
                    <div className="font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded">
                      Scheduled Delivery: {new Date(o.deliveryDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  ) : (
                    <div className="text-ink-soft">Delivery: Confirmation in progress</div>
                  )}
                  <span className="text-brand font-semibold hover:underline flex items-center gap-1">
                    Track live status →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
