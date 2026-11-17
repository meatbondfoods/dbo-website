"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, Package, UserRound } from "lucide-react";

const ITEMS = [
  { href: "/account", label: "Dashboard", Icon: Home }, { href: "/account/profile", label: "Profile", Icon: UserRound },
  { href: "/account/addresses", label: "Addresses", Icon: MapPin }, { href: "/account/orders", label: "Orders", Icon: Package },
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="flex gap-2 overflow-x-auto lg:flex-col">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/account" ? path === "/account" : path.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-[44px] shrink-0 items-center gap-2.5 rounded-lg px-3.5 text-sm font-semibold transition-colors ${active ? "bg-brand text-white" : "border border-hairline bg-white text-ink hover:bg-mint-light lg:border-transparent lg:bg-transparent"}`}><Icon size={17} aria-hidden />{label}</Link>;
      })}
    </nav>
  );
}
