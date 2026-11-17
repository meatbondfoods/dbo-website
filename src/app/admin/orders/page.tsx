import Link from "next/link";
import { getRepositories } from "@/lib/repositories";
import { taka } from "@/lib/format";
import { StatusBadge } from "../_components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function OrdersAdmin() {
  const orders = await getRepositories().orders.listAll();
  return (
    <div className="py-8">
      <h1 className="text-3xl">Orders</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">A read-only view of website orders. In production this is the ERP order inbox: ERP staff review, convert and confirm orders there, and the status shown to customers mirrors the ERP. Website admins do not confirm or dispatch orders.</p>
      {orders.length === 0 ? (
        <div className="card mt-6 p-10 text-center"><p className="text-lg font-bold text-deep">No orders yet</p><p className="mt-1 text-sm text-ink-soft">Place a test order on the storefront and it will appear here.</p></div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-white shadow-soft">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-hairline bg-mint-light text-xs uppercase tracking-wide text-ink"><tr>
              {["Order", "Placed", "Customer", "Area", "Total", "Payment", "Status"].map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-hairline">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-mint-light/50">
                  <th scope="row" className="px-4 py-3 font-semibold"><Link href={`/admin/orders/${o.reference}`} className="text-brand hover:underline">{o.reference}</Link></th>
                  <td className="px-4 py-3 text-ink-soft">{new Date(o.createdAt).toLocaleString("en-GB")}</td>
                  <td className="px-4 py-3">{o.input.customer.name}<span className="block text-xs text-ink-soft">{o.input.customer.phone}</span></td>
                  <td className="px-4 py-3">{o.input.address.area}</td>
                  <td className="px-4 py-3 font-semibold">{taka(o.total)}</td>
                  <td className="px-4 py-3 uppercase">{o.input.paymentMethod}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                </tr>))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
