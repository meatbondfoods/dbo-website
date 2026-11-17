"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import type { Category } from "@/lib/domain/types";
import type { ContentMap } from "@/lib/content/schema";
import { Wordmark } from "./Wordmark";
import { SearchBar } from "./SearchBar";
import { useCart, useHydrated } from "@/store/cart";
import { useUI } from "@/store/ui";

export function Header({ categories, announcement, nav, logo }: { categories: Category[]; announcement: string; nav: ContentMap["navigation"]; logo: ContentMap["brand"] }) {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const count = useCart((s) => s.lines.reduce((n, l) => n + l.quantity, 0));
  const openDrawer = useUI((s) => s.openDrawer);
  const [menu, setMenu] = useState(false);
  const [cats, setCats] = useState(false);
  const [search, setSearch] = useState(false);
  const catsRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation, and close the categories menu on outside click or Escape.
  useEffect(() => { setMenu(false); setCats(false); setSearch(false); }, [pathname]);
  useEffect(() => {
    const click = (e: MouseEvent) => { if (catsRef.current && !catsRef.current.contains(e.target as Node)) setCats(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setCats(false); setMenu(false); setSearch(false); } };
    document.addEventListener("mousedown", click); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); document.removeEventListener("keydown", key); };
  }, []);

  const link = (href: string, label: string) => {
    const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link href={href} aria-current={active ? "page" : undefined}
        className={`relative py-2 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:bg-gold after:transition-transform ${active ? "text-brand after:scale-x-100" : "text-ink hover:text-brand after:scale-x-0 hover:after:scale-x-100"}`}>
        {label}
      </Link>
    );
  };

  const cartLabel = `Open cart, ${hydrated ? count : 0} item${count === 1 ? "" : "s"}`;
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white">
      {announcement && <div className="on-dark bg-deep py-2 text-center text-xs font-medium text-white">{announcement}</div>}
      <div className="container-page flex h-[72px] items-center gap-6">
        <Wordmark logo={{ path: logo.logoPath, alt: logo.logoAlt }} />
        <nav aria-label="Main" className="ml-4 hidden items-center gap-7 lg:flex">
          {nav.items.slice(0, 2).map((i) => <span key={i.href + i.label} className="contents">{link(i.href, i.label)}</span>)}
          {nav.showCategories && <div ref={catsRef} className="relative">
            <button aria-expanded={cats} aria-haspopup="true" onClick={() => setCats(!cats)}
              className="inline-flex items-center gap-1 py-2 text-sm font-semibold text-ink hover:text-brand">
              Categories <ChevronDown size={15} aria-hidden className={`transition-transform ${cats ? "rotate-180" : ""}`} />
            </button>
            {cats && (
              <ul className="absolute left-0 top-full z-50 mt-2 w-64 animate-fade-in rounded-xl border border-hairline bg-white p-2 shadow-lift">
                {categories.map((c) => (
                  <li key={c.id}><Link href={`/shop?category=${c.slug}`} className="block rounded-lg px-3 py-2.5 text-sm hover:bg-mint-light"><span className="font-semibold text-deep">{c.name}</span><span className="block text-xs text-ink-soft">{c.description}</span></Link></li>
                ))}
              </ul>
            )}
          </div>}
          {nav.items.slice(2).map((i) => <span key={i.href + i.label} className="contents">{link(i.href, i.label)}</span>)}
        </nav>
        <div className="ml-auto hidden w-72 xl:block"><SearchBar /></div>
        <div className="ml-auto flex items-center gap-1 xl:ml-0">
          <button className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-mint-light xl:hidden" aria-label="Search products" aria-expanded={search} onClick={() => { setSearch(!search); setMenu(false); }}><Search size={21} aria-hidden /></button>
          <Link href="/account" aria-label="My account" className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-mint-light"><User size={21} aria-hidden /></Link>
          <button onClick={openDrawer} aria-label={cartLabel} className="relative flex h-11 items-center gap-2 rounded-lg bg-brand px-3.5 text-white shadow-soft hover:bg-deep">
            <ShoppingBag size={19} aria-hidden /><span className="hidden text-sm font-semibold sm:inline">Cart</span>
            {hydrated && count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-deep">{count}</span>}
          </button>
          <button className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-mint-light lg:hidden" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} onClick={() => { setMenu(!menu); setSearch(false); }}>
            {menu ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </div>
      {search && <div className="border-t border-hairline bg-white py-3 xl:hidden"><div className="container-page"><SearchBar autoFocus onDone={() => setSearch(false)} /></div></div>}
      {menu && (
        <nav aria-label="Mobile" className="max-h-[calc(100vh-110px)] overflow-y-auto border-t border-hairline bg-white lg:hidden">
          <div className="container-page flex flex-col py-3">
            {nav.items.map((i) => <Link key={i.href + i.label} href={i.href} className="rounded-lg px-2 py-3 text-base font-semibold hover:bg-mint-light">{i.label}</Link>)}
            {nav.showCategories && <><p className="px-2 pb-1 pt-3 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Categories</p>
            {categories.map((c) => <Link key={c.id} href={`/shop?category=${c.slug}`} className="rounded-lg px-4 py-2.5 text-base hover:bg-mint-light">{c.name}</Link>)}</>}
            <div className="mt-2 border-t border-hairline pt-2">
              <Link href="/track" className="block rounded-lg px-2 py-3 text-base font-semibold hover:bg-mint-light">Track an order</Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
