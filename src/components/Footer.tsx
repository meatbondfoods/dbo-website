import Link from "next/link";
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
import type { Category } from "@/lib/domain/types";
import { Wordmark } from "./Wordmark";

// Contact + social details come from env (see .env.example). Nothing is invented: unset means hidden.
const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE;
const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
const address = process.env.NEXT_PUBLIC_CONTACT_ADDRESS;
const SOCIAL = [
  { label: "Facebook", href: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK, Icon: Facebook },
  { label: "Instagram", href: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM, Icon: Instagram },
  { label: "YouTube", href: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE, Icon: Youtube },
].filter((s): s is { label: string; href: string; Icon: typeof Facebook } => !!s.href);

export function Footer({ categories }: { categories: Category[] }) {
  const col = "text-xs font-bold uppercase tracking-[0.16em] text-gold";
  const a = "text-sm text-white/85 transition-colors hover:text-white hover:underline underline-offset-4";
  return (
    <footer className="on-dark mt-24 bg-deep text-white">
      <div className="container-page grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <Wordmark light />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/80">Premium meat, poultry and food shopping from MeatBond Foods, packed with care and delivered across Dhaka.</p>
          {SOCIAL.length > 0 && (
            <ul className="mt-6 flex gap-2" aria-label="Social media">
              {SOCIAL.map(({ label, href, Icon }) => <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 hover:bg-white/10"><Icon size={18} aria-hidden /></a></li>)}
            </ul>
          )}
        </div>
        <nav aria-label="Shop"><h2 className={col}>Shop</h2>
          <ul className="mt-4 space-y-2.5"><li><Link href="/shop" className={a}>All products</Link></li>
            {categories.map((c) => <li key={c.id}><Link href={`/shop?category=${c.slug}`} className={a}>{c.name}</Link></li>)}</ul></nav>
        <nav aria-label="Customer support"><h2 className={col}>Support</h2>
          <ul className="mt-4 space-y-2.5">{[["Track an order", "/track"], ["My account", "/account"], ["Delivery information", "/delivery-information"], ["FAQs", "/faqs"], ["Contact us", "/contact"], ["About Us", "/about"]].map(([l, h]) => <li key={h}><Link href={h} className={a}>{l}</Link></li>)}</ul></nav>
        <div><h2 className={col}>Contact</h2>
          {phone || email || address ? (
            <ul className="mt-4 space-y-3 text-sm text-white/85">
              {phone && <li className="flex gap-2.5"><Phone size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden /><a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:underline">{phone}</a></li>}
              {email && <li className="flex gap-2.5"><Mail size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden /><a href={`mailto:${email}`} className="break-all hover:underline">{email}</a></li>}
              {address && <li className="flex gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden /><span>{address}</span></li>}
            </ul>
          ) : <p className="mt-4 text-sm text-white/80">Phone, email and address will appear here once confirmed. <Link href="/contact" className="font-semibold text-white underline underline-offset-4">Contact page</Link></p>}
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/75 sm:flex-row">
          <p>© {new Date().getFullYear()} MeatBond Mart. A MeatBond Foods brand.</p>
          <ul className="flex gap-5"><li><Link href="/privacy-policy" className="hover:text-white hover:underline">Privacy policy</Link></li><li><Link href="/terms" className="hover:text-white hover:underline">Terms &amp; conditions</Link></li></ul>
        </div>
        <p className="border-t border-white/10 py-2.5 text-center text-[11px] text-white/65">Demo storefront: products, prices, reviews and some copy are sample content.</p>
      </div>
    </footer>
  );
}
