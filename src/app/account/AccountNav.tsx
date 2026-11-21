"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, Package, UserRound, ChevronRight } from "lucide-react";

const ITEMS = [
  { href: "/account", label: "Dashboard", Icon: Home },
  { href: "/account/profile", label: "Profile", Icon: UserRound },
  { href: "/account/addresses", label: "Delivery Addresses", Icon: MapPin },
  { href: "/account/orders", label: "My Orders", Icon: Package },
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Customer Account Navigation" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:pb-0">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/account" ? path === "/account" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`group flex min-h-[44px] shrink-0 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 ${
              active
                ? "bg-[#0B3B17] text-white shadow-sm"
                : "border border-hairline/70 bg-white text-ink hover:bg-mint-light/60 hover:text-[#0B3B17] lg:border-transparent lg:bg-transparent"
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Icon
                size={18}
                className={active ? "text-white" : "text-leaf transition-colors group-hover:text-[#0B3B17]"}
                aria-hidden
              />
              <span>{label}</span>
            </span>
            <ChevronRight
              size={15}
              className={`hidden lg:block transition-transform duration-200 ${
                active
                  ? "text-white/80 translate-x-0.5"
                  : "text-ink-soft/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
              }`}
              aria-hidden
            />
          </Link>
        );
      })}
    </nav>
  );
}
