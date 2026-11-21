import Link from "next/link";
import { MapPin, Package, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/page";
import { listAddresses } from "@/lib/auth/service";
import { getRepositories } from "@/lib/repositories";
import { taka } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AccountHome() {
  const user = await requireUser("/account");
  const [addresses, orders] = await Promise.all([
    listAddresses(user),
    getRepositories().orders.listForCustomer(user.customerId, user.phone, user.email),
  ]);
  const def = addresses.find((a) => a.isDefault) ?? addresses[0];
  return (
    <div>
      <h1 className="text-3xl sm:text-4xl">Welcome, {user.fullName.split(" ")[0]}</h1>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <section className="card p-5" aria-labelledby="pid"><div className="flex items-center gap-2 text-leaf"><UserRound size={18} aria-hidden /><h2 id="pid" className="text-base">Your profile</h2></div>
          <dl className="mt-3 space-y-2 text-sm">
            <div><dt className="text-ink-soft">Customer ID</dt><dd className="font-mono text-base font-bold text-deep" data-testid="customer-id">{user.customerCode}</dd></div>
            <div><dt className="text-ink-soft">Email</dt><dd className="break-all font-medium">{user.email}</dd></div>
            {user.phone && <div><dt className="text-ink-soft">Mobile</dt><dd className="font-medium">{user.phone}</dd></div>}
          </dl><Link href="/account/profile" className="mt-4 inline-block text-sm font-semibold text-brand underline">Edit profile</Link></section>
        <section className="card p-5" aria-labelledby="pad"><div className="flex items-center gap-2 text-leaf"><MapPin size={18} aria-hidden /><h2 id="pad" className="text-base">Delivery address</h2></div>
          {def ? <p className="mt-3 text-sm">{def.fullName}<br />{def.line1}<br />{def.area}, {def.city}{def.postalCode && ` ${def.postalCode}`}<br />{def.phone}</p> : <p className="mt-3 text-sm text-ink-soft">No saved address yet.</p>}
          <Link href="/account/addresses" className="mt-4 inline-block text-sm font-semibold text-brand underline">{addresses.length ? `Manage ${addresses.length} address${addresses.length === 1 ? "" : "es"}` : "Add an address"}</Link></section>
        <section className="card p-5" aria-labelledby="por"><div className="flex items-center gap-2 text-leaf"><Package size={18} aria-hidden /><h2 id="por" className="text-base">Orders</h2></div>
          <p className="mt-3 text-3xl font-extrabold text-deep">{orders.length}</p><p className="text-sm text-ink-soft">order{orders.length === 1 ? "" : "s"} placed</p>
          <Link href="/account/orders" className="mt-4 inline-block text-sm font-semibold text-brand underline">View order history</Link></section>
      </div>

      <section className="card mt-6 p-5" aria-labelledby="rec">
        <div className="flex items-center justify-between"><h2 id="rec" className="text-lg">Recent orders</h2><Link href="/account/orders" className="text-sm font-semibold text-brand hover:underline">View all</Link></div>
        {orders.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-ink-soft/40 p-8 text-center"><p className="font-bold text-deep">No orders yet</p><p className="mt-1 text-sm text-ink-soft">Orders you place while signed in appear here with live status.</p><Link href="/shop" className="btn-primary mt-4">Start shopping</Link></div>
        ) : (
          <ul className="mt-3 divide-y divide-hairline">
            {orders.slice(0, 3).map((o) => (
              <li key={o.id}><Link href={`/account/orders/${o.reference}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-mint-light/60">
                <span><span className="font-semibold text-deep">{o.reference}</span><span className="block text-xs text-ink-soft">{new Date(o.createdAt).toLocaleDateString("en-GB")} · {taka(o.total)}</span></span><StatusBadge status={o.status} /></Link></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
