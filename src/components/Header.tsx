"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { useCart, useHydrated } from "@/store/cart";

const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=chicken", label: "Chicken" },
  { href: "/shop?category=beef", label: "Beef" },
  { href: "/about", label: "About" },
  { href: "/delivery-information", label: "Delivery" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur">
      <div className="bg-forest py-1.5 text-center text-xs text-cream">Free delivery on orders over ৳1,500 · Chilled, same-day in Dhaka</div>
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-charcoal/80 transition-colors hover:text-forest">{n.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/account" aria-label="Account" className="rounded-md p-2 hover:bg-forest-tint"><User size={20} /></Link>
          <Link href="/cart" aria-label={`Cart, ${hydrated ? count : 0} items`} className="relative rounded-md p-2 hover:bg-forest-tint">
            <ShoppingBag size={20} />
            {hydrated && count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-clay px-1 text-[10px] font-semibold text-white">{count}</span>
            )}
          </Link>
          <button className="rounded-md p-2 hover:bg-forest-tint md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t border-line bg-cream md:hidden">
          <div className="container-page flex flex-col py-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="border-b border-line/60 py-3 text-sm font-medium last:border-0">{n.label}</Link>
            ))}
            <Link href="/track" onClick={() => setOpen(false)} className="py-3 text-sm font-medium">Track order</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
