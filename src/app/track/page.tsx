import type { Metadata } from "next";
import Link from "next/link";
import { TrackForm } from "@/components/TrackForm";
import { currentCustomer } from "@/lib/auth/service";
import { getRepositories } from "@/lib/repositories";
import { StatusBadge } from "@/components/StatusBadge";
import { taka } from "@/lib/format";

export const metadata: Metadata = { title: "Track your order" };
export const dynamic = "force-dynamic";

export default async function TrackPage() {
  const user = await currentCustomer();
  const orders = user
    ? await getRepositories().orders.listForCustomer(user.customerId, user.phone, user.email)
    : [];

  return (
    <div className="container-page max-w-3xl py-12">
      {user ? (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h1 className="text-3xl sm:text-4xl">Track Your Orders</h1>
              <p className="mt-2 text-sm text-ink-soft">
                Welcome back, <strong className="text-deep">{user.fullName || "Customer"}</strong>. Here is the current situation of your orders.
              </p>
            </div>
            <Link href="/account/orders" className="btn-outline text-xs py-2 px-3">
              Go to Profile / My Orders
            </Link>
          </div>

          {orders.length > 0 ? (
            <div className="mt-8 space-y-4">
              <h2 className="text-lg font-bold text-deep">Your Orders &amp; Live Situations</h2>
              <ul className="space-y-4">
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
                            Ordered on {new Date(o.createdAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · {taka(o.total)}
                          </p>
                        </div>
                        <span className="text-brand text-xs font-semibold hover:underline">
                          View Timeline Tracker →
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-hairline flex flex-wrap items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-ink-soft">Current situation:</span>
                          <span className="font-semibold text-deep capitalize">
                            {o.status === "pending_confirmation" ? "Order received (Awaiting staff review)" :
                             o.status === "confirmed" ? "Order Confirmed" :
                             o.status === "processing" ? "In Processing / Cutting" :
                             o.status === "ready" ? "Ready for Dispatch" :
                             o.status === "dispatched" ? "Out for Delivery" :
                             o.status === "delivered" ? "Delivered" : o.status}
                          </span>
                        </div>
                        {o.deliveryDate ? (
                          <div className="font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded">
                            Scheduled: {new Date(o.deliveryDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        ) : (
                          <div className="text-ink-soft">Delivery: Confirmation in progress</div>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-ink-soft/40 p-6 text-center bg-white">
              <p className="font-semibold text-deep">No orders placed under your account yet.</p>
              <Link href="/shop" className="btn-primary mt-3 text-sm py-2 px-4 inline-block">
                Start Shopping
              </Link>
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-hairline">
            <h3 className="text-base font-semibold text-deep mb-2">Track another order by number</h3>
            <p className="text-xs text-ink-soft mb-6">
              If you placed an order as a guest without signing in, enter its reference and mobile number below:
            </p>
            <TrackForm />
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-4xl">Track your order</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Enter your order number and the mobile number used at checkout.
          </p>

          <div className="my-6 p-4 rounded-xl bg-mint-light/60 border border-hairline flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-semibold text-deep">Have a MeatBond account?</p>
              <p className="text-xs text-ink-soft mt-0.5">
                Sign in to view all your orders and live situations directly without writing any order numbers.
              </p>
            </div>
            <Link href="/login?next=/account/orders" className="btn-primary text-xs py-2 px-4 whitespace-nowrap">
              Sign In to View Orders
            </Link>
          </div>

          <TrackForm />
        </div>
      )}
    </div>
  );
}
