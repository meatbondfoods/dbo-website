import Link from "next/link";
import { getRepositories } from "@/lib/repositories";
import { getAdminState } from "@/lib/content/store";
import { CONTENT_KEYS } from "@/lib/content/schema";
import { taka } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = { hero: "Homepage hero", theme: "Theme", site: "Site and contact", commerce: "Delivery", productDisplay: "Product display", banners: "Banners", navigation: "Navigation menu", sections: "Homepage sections", seo: "SEO", brand: "Logo and brand" };
const HREFS: Record<string, string> = { hero: "/admin/content/hero", theme: "/admin/content/theme", site: "/admin/content/site", commerce: "/admin/content/commerce", productDisplay: "/admin/products", banners: "/admin/content/banners", navigation: "/admin/content/navigation", sections: "/admin/content/sections", seo: "/admin/content/seo", brand: "/admin/content/brand" };

export default async function AdminDashboard() {
  const orders = await getRepositories().orders.listAll();
  const n = (...s: string[]) => orders.filter((o) => s.includes(o.status)).length;
  const stats = [
    { label: "Total orders", value: orders.length }, { label: "Pending confirmation", value: n("pending_confirmation") },
    { label: "Confirmed", value: n("confirmed") }, { label: "Processing", value: n("processing", "ready", "dispatched") },
    { label: "Delivered", value: n("delivered") }, { label: "Cancelled / rejected", value: n("cancelled", "rejected") },
  ];
  const pending = CONTENT_KEYS.filter((k) => getAdminState(k).differs);

  return (
    <div className="py-8">
      <h1 className="text-3xl">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">Orders below are demo orders held in memory. In production they come from the ERP order inbox.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((s) => <div key={s.label} className="card p-5"><p className="text-sm font-medium text-ink-soft">{s.label}</p><p className="mt-1 text-3xl font-extrabold text-deep">{s.value}</p></div>)}
        <div className="card p-5"><p className="text-sm font-medium text-ink-soft">Website visitors</p><p className="mt-1 text-lg font-bold text-deep">Not tracked yet</p><p className="mt-1 text-xs text-ink-soft">Needs an analytics source (for example Vercel Analytics).</p></div>
        <div className="card p-5"><p className="text-sm font-medium text-ink-soft">Registered customers</p><p className="mt-1 text-lg font-bold text-deep">Accounts not live</p><p className="mt-1 text-xs text-ink-soft">Customer accounts launch with phone OTP, which is not available yet.</p></div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="ro" className="card p-5">
          <div className="flex items-center justify-between"><h2 id="ro" className="text-lg">Recent orders</h2><Link href="/admin/orders" className="text-sm font-semibold text-brand hover:underline">View all</Link></div>
          {orders.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No orders yet. Place a test order on the storefront to see it here.</p> : (
            <ul className="mt-3 divide-y divide-hairline">
              {orders.slice(0, 5).map((o) => (
                <li key={o.id}><Link href={`/admin/orders/${o.reference}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-mint-light/60">
                  <span><span className="font-semibold text-deep">{o.reference}</span><span className="block text-xs text-ink-soft">{o.input.customer.name} · {taka(o.total)}</span></span><StatusBadge status={o.status} /></Link></li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="cs" className="card p-5">
          <h2 id="cs" className="text-lg">Website content</h2>
          <ul className="mt-3 divide-y divide-hairline text-sm">
            {CONTENT_KEYS.map((k) => <li key={k} className="flex items-center justify-between py-2.5"><Link href={HREFS[k]} className="font-semibold text-brand hover:underline">{LABELS[k]}</Link>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pending.includes(k) ? "bg-gold/25 text-deep" : "bg-mint text-deep"}`}>{pending.includes(k) ? "Unpublished changes" : "Up to date"}</span></li>)}
          </ul>
          
        </section>
      </div>
      <section className="card mt-6 p-5"><h2 className="text-lg">Recent customer registrations</h2><p className="mt-2 text-sm text-ink-soft">None yet. Registration uses phone OTP, which is being set up.</p></section>
    </div>
  );
}
