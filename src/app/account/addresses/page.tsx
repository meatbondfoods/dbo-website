import { requireUser } from "@/lib/auth/page";
import { listAddresses } from "@/lib/auth/service";
import { AddressManager } from "./AddressManager";
import { Truck } from "lucide-react";

export const metadata = { title: "Delivery Addresses — MeatBond Mart" };
export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await listAddresses(user);

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <header className="border-b border-hairline/80 pb-5">
        <span className="eyebrow block">My Account • Addresses</span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-deep tracking-tight">
          Delivery addresses
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft max-w-2xl leading-relaxed">
          Manage your saved destinations with live GPS location pins for prompt, chilled delivery across Chattagram.
        </p>

        {/* Hub Delivery Promise Badge */}
        <div className="mt-3.5 inline-flex flex-wrap items-center gap-2 rounded-xl border border-brand/20 bg-mint-light/60 px-3.5 py-1.5 text-xs font-semibold text-[#0B3B17]">
          <Truck size={14} className="text-leaf" />
          <span>Chandgaon Hub: Free chilled delivery within 7 km</span>
          <span className="text-ink-soft/40 hidden sm:inline">•</span>
          <span>Chilled delivery exclusively across Chattagram</span>
        </div>
      </header>

      <AddressManager
        initial={addresses}
        defaultName={user.fullName}
        defaultPhone={user.phone}
      />
    </div>
  );
}
