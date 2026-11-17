import Link from "next/link";
import { currentCustomer } from "@/lib/auth/service";
import { LogoutButton } from "@/components/auth/forms";
import { AccountNav } from "./AccountNav";

export const dynamic = "force-dynamic";

// Each page enforces sign-in itself (requireUser); this layout only adds the frame when a session exists.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await currentCustomer();
  if (!user) return <div className="container-page py-10">{children}</div>;
  return (
    <div className="container-page py-10">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-32 lg:h-fit">
          <AccountNav />
          <div className="mt-4 hidden lg:block"><LogoutButton /></div>
          <p className="mt-4 hidden text-xs text-ink-soft lg:block">Need help? <Link href="/contact" className="underline">Contact us</Link></p>
        </aside>
        <div className="min-w-0">{children}<div className="mt-8 lg:hidden"><LogoutButton /></div></div>
      </div>
    </div>
  );
}
