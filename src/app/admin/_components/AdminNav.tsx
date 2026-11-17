"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, Brush, Home, Image as ImageIcon, Menu, Package, Palette, Settings2, Truck, Users, X } from "lucide-react";

const GROUPS = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard", Icon: Home }] },
  { title: "Sales", items: [{ href: "/admin/orders", label: "Orders", Icon: Package }, { href: "/admin/customers", label: "Customers", Icon: Users }] },
  { title: "Website", items: [
    { href: "/admin/products", label: "Product display", Icon: Boxes },
    { href: "/admin/content/hero", label: "Homepage hero", Icon: ImageIcon },
    { href: "/admin/content/theme", label: "Theme", Icon: Palette },
    { href: "/admin/content/site", label: "Site and contact", Icon: Settings2 },
    { href: "/admin/content/commerce", label: "Delivery", Icon: Truck },
  ] },
];

export function AdminNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const list = (
    <nav aria-label="Admin" className="space-y-6">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-soft">{g.title}</p>
          <ul className="space-y-1">
            {g.items.map(({ href, label, Icon }) => {
              const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
              return <li key={href}><Link href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${active ? "bg-brand text-white" : "text-ink hover:bg-mint-light"}`}><Icon size={18} aria-hidden />{label}</Link></li>;
            })}
          </ul>
        </div>
      ))}
      <Link href="/" className="flex min-h-[44px] items-center gap-3 rounded-lg border border-hairline px-3 text-sm font-semibold text-brand hover:bg-mint-light"><Brush size={18} aria-hidden />View website</Link>
    </nav>
  );
  return (
    <>
      <div className="flex items-center justify-between border-b border-hairline bg-white px-4 py-3 lg:hidden">
        <span className="font-bold text-deep">MeatBond Mart admin</span>
        <button aria-label={open ? "Close admin menu" : "Open admin menu"} aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-mint-light">{open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}</button>
      </div>
      {open && <div className="border-b border-hairline bg-white p-4 lg:hidden">{list}</div>}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-hairline bg-white p-4 lg:block"><p className="px-3 pb-5 pt-2 text-lg font-extrabold text-deep">MeatBond Mart <span className="block text-xs font-semibold uppercase tracking-[0.16em] text-leaf">Admin</span></p>{list}</aside>
    </>
  );
}
