import Link from "next/link";
import { currentCustomer } from "@/lib/auth/service";
import { LogoutButton } from "@/components/auth/forms";
import { AccountNav } from "./AccountNav";
import { HelpCircle } from "lucide-react";

export const dynamic = "force-dynamic";

// Each page enforces sign-in itself (requireUser); this layout adds the customer frame when a session exists.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await currentCustomer();
  if (!user) return <div className="container-page py-10">{children}</div>;

  const initials = user.fullName
    ? user.fullName
        .split(" ")
        .filter(Boolean)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "MB";

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-28 lg:h-fit">
          <div className="card space-y-4 p-4 sm:p-5">
            {/* Customer mini profile identity */}
            <div className="flex items-center gap-3 border-b border-hairline/80 pb-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mint-light font-bold text-[#0B3B17] border border-[#0B3B17]/20 shadow-xs">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-deep leading-tight">
                  {user.fullName || "Valued Customer"}
                </p>
                <p className="truncate text-xs text-ink-soft mt-0.5">
                  {user.phone || user.email}
                </p>
              </div>
            </div>

            {/* Navigation links */}
            <AccountNav />

            {/* Sign out button & Help */}
            <div className="border-t border-hairline/80 pt-3 space-y-3">
              <LogoutButton variant="outline" className="w-full justify-center text-xs" />
              <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                <HelpCircle size={14} className="text-leaf shrink-0" />
                <span>Need delivery help? </span>
                <Link href="/contact" className="font-semibold text-brand underline hover:text-deep">
                  Contact hub
                </Link>
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          {children}
          <div className="mt-8 border-t border-hairline pt-6 lg:hidden">
            <LogoutButton variant="outline" className="w-full justify-center" />
          </div>
        </main>
      </div>
    </div>
  );
}
