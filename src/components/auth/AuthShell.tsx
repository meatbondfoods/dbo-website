import Link from "next/link";
import { accountsEnabled } from "@/lib/auth/service";
import { authMode } from "@/lib/auth/config";

/** Frame for /login, /register and friends. When accounts are off (today's live site) it says so honestly. */
export function AuthShell({ title, intro, children, footer }: { title: string; intro?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!accountsEnabled()) {
    return (
      <div className="container-page max-w-lg py-16 text-center">
        <h1 className="text-3xl">Customer accounts are coming soon</h1>
        <p className="mt-3 text-ink-soft">You can still browse and place orders as a guest, and track an order with its reference and your mobile number.</p>
        <div className="mt-6 flex justify-center gap-3"><Link href="/shop" className="btn-primary">Browse the shop</Link><Link href="/track" className="btn-outline">Track an order</Link></div>
      </div>
    );
  }
  return (
    <div className="container-page max-w-md py-12">
      {authMode() === "demo" && <p className="mb-6 rounded-lg border-2 border-dashed border-gold bg-white p-3 text-xs text-ink">Development demo accounts. Stored in a local file on this computer, disabled in production.</p>}
      <h1 className="text-3xl sm:text-4xl">{title}</h1>
      {intro && <p className="mt-2 text-sm text-ink-soft">{intro}</p>}
      <div className="card mt-6 p-6">{children}</div>
      {footer && <div className="mt-5 text-center text-sm text-ink-soft">{footer}</div>}
    </div>
  );
}
