import Link from "next/link";
import { notFound } from "next/navigation";
import { getRepositories } from "@/lib/repositories";
import { OrderStatusView } from "@/components/OrderStatusView";
import { OrderStatusControls } from "../../_components/OrderStatusControls";
import { StatusBadge } from "@/components/StatusBadge";

export const dynamic = "force-dynamic";

export default async function OrderDetail({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const order = (await getRepositories().orders.listAll()).find((o) => o.reference === reference);
  if (!order) notFound();
  const { customer, address } = order.input;
  return (
    <div className="py-8">
      <Link href="/admin/orders" className="text-sm font-semibold text-brand hover:underline">← All orders</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3"><h1 className="text-3xl">{order.reference}</h1><StatusBadge status={order.status} /></div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <OrderStatusView order={{ reference: order.reference, status: order.status, createdAt: order.createdAt, subtotal: order.subtotal, deliveryCharge: order.deliveryCharge, total: order.total, lines: order.input.lines, paymentMethod: order.input.paymentMethod }} />
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="cu"><h2 id="cu" className="text-lg">Customer</h2>
            <dl className="mt-3 space-y-2 text-sm"><div><dt className="text-ink-soft">Name</dt><dd className="font-semibold">{customer.name}</dd></div>
              <div><dt className="text-ink-soft">Mobile</dt><dd className="font-semibold">{customer.phone}</dd></div>
              {customer.email && <div><dt className="text-ink-soft">Email</dt><dd className="font-semibold">{customer.email}</dd></div>}</dl></section>
          <section className="card p-5" aria-labelledby="ad"><h2 id="ad" className="text-lg">Delivery</h2>
            <p className="mt-3 text-sm">{address.line1}<br />{address.area}, {address.city}</p>
            {address.notes && <p className="mt-2 text-sm text-ink-soft">Note: {address.notes}</p>}
            <p className="mt-3 text-sm text-ink-soft">Payment: <span className="font-semibold uppercase text-ink">{order.input.paymentMethod}</span> (unpaid until delivery)</p></section>
          <OrderStatusControls reference={order.reference} status={order.status} />
        </div>
      </div>
    </div>
  );
}
