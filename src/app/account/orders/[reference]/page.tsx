import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/page";
import { getRepositories } from "@/lib/repositories";
import { toTracked } from "@/lib/orderView";
import { OrderStatusView } from "@/components/OrderStatusView";

export const metadata = { title: "Order details" };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const user = await requireUser(`/account/orders/${reference}`);
  // Only the signed-in customer's own orders are searched, so another customer's reference is just "not found".
  const order = (await getRepositories().orders.listForCustomer(user.customerId)).find((o) => o.reference === reference);
  if (!order) notFound();
  const { address } = order.input;
  return (
    <div>
      <Link href="/account/orders" className="text-sm font-semibold text-brand hover:underline">← Order history</Link>
      <h1 className="mt-2 text-3xl">Order {order.reference}</h1>
      <div className="mt-6 space-y-6">
        <OrderStatusView order={toTracked(order)} />
        <section className="card p-5" aria-labelledby="dl"><h2 id="dl" className="text-lg">Delivery address</h2>
          <p className="mt-2 text-sm">{address.line1}<br />{address.area}, {address.city}</p>{address.notes && <p className="mt-1 text-sm text-ink-soft">Note: {address.notes}</p>}</section>
      </div>
    </div>
  );
}
