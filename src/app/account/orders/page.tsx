import Link from "next/link";
import { requireUser } from "@/lib/auth/page";
import { getRepositories } from "@/lib/repositories";
import { taka } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "Order history" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await getRepositories().orders.listForCustomer(user.customerId);
  return (
    <div>
      <h1 className="text-3xl">Order history</h1>
      {orders.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-ink-soft/40 bg-white p-10 text-center"><p className="font-bold text-deep">No orders yet</p><p className="mt-1 text-sm text-ink-soft">When you place an order while signed in, it will appear here.</p><Link href="/shop" className="btn-primary mt-5">Start shopping</Link></div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.id}><Link href={`/account/orders/${o.reference}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition-shadow hover:shadow-lift">
              <span><span className="block font-bold text-deep">{o.reference}</span><span className="text-sm text-ink-soft">{new Date(o.createdAt).toLocaleDateString("en-GB")} · {o.input.lines.reduce((n, l) => n + l.quantity, 0)} item(s)</span></span>
              <span className="text-right"><span className="block font-bold">{taka(o.total)}</span><StatusBadge status={o.status} /></span></Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
