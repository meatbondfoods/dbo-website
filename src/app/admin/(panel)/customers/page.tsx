import { getRepositories } from "@/lib/repositories";
import { formatCustomerCode, normalizeBdPhone } from "@/lib/identity";
import { taka } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CustomersAdmin() {
  const orders = (await getRepositories().orders.listAll()).slice().reverse();     // oldest first
  // DEMO: customers are derived from demo orders by phone. Real customers come from verified phone-OTP accounts.
  const byPhone = new Map<string, { name: string; phone: string; orders: number; spent: number; first: string }>();
  for (const o of orders) {
    const key = normalizeBdPhone(o.input.customer.phone) ?? o.input.customer.phone;
    const c = byPhone.get(key) ?? { name: o.input.customer.name, phone: key, orders: 0, spent: 0, first: o.createdAt };
    c.orders += 1; c.spent += o.total; byPhone.set(key, c);
  }
  const rows = [...byPhone.values()];
  return (
    <div className="py-8">
      <h1 className="text-3xl">Customers</h1>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">Demo view: customers are derived from demo orders by mobile number. Real accounts will get a permanent ID like <code className="rounded bg-mint-light px-1.5 py-0.5">MBM-CUS-000001</code> when phone OTP registration goes live, and will be matched to existing ERP customers by verified phone number.</p>
      {rows.length === 0 ? <div className="card mt-6 p-10 text-center"><p className="text-lg font-bold text-deep">No customers yet</p></div> : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-hairline bg-white shadow-soft">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-hairline bg-mint-light text-xs uppercase tracking-wide text-ink"><tr>{["Demo ID", "Name", "Mobile", "Orders", "Total spent", "First order"].map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-hairline">{rows.map((c, i) => (
              <tr key={c.phone}><th scope="row" className="px-4 py-3 font-mono text-xs font-semibold">{formatCustomerCode(i + 1)}</th><td className="px-4 py-3 font-semibold">{c.name}</td><td className="px-4 py-3">{c.phone}</td><td className="px-4 py-3">{c.orders}</td><td className="px-4 py-3 font-semibold">{taka(c.spent)}</td><td className="px-4 py-3 text-ink-soft">{new Date(c.first).toLocaleDateString("en-GB")}</td></tr>))}</tbody>
          </table>
        </div>)}
    </div>
  );
}
