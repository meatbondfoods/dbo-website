import Link from "next/link";
import { Facebook, Instagram, Mail, MapPin, Phone, Youtube } from "lucide-react";
import type { Category } from "@/lib/domain/types";
import type { ContentMap } from "@/lib/content/schema";
import { Wordmark } from "./Wordmark";

// Contact details and social links come from the admin-managed "site" content. Nothing is invented: blank means hidden.
export function Footer({ categories, site, logo }: { categories: Category[]; site: ContentMap["site"]; logo: ContentMap["brand"] }) {
  const social = [
    { label: "Facebook", href: site.facebook, Icon: Facebook },
    { label: "Instagram", href: site.instagram, Icon: Instagram },
    { label: "YouTube", href: site.youtube, Icon: Youtube },
  ].filter((s) => s.href);
  const col = "text-xs font-bold uppercase tracking-[0.16em] text-gold";
  const a = "text-sm text-white/85 transition-colors hover:text-white hover:underline underline-offset-4";
  return (
    <footer className="on-dark mt-24 bg-deep text-white">
      <div className="container-page grid gap-10 py-16 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
        <div>
          <Wordmark light logo={{ path: logo.logoPath, alt: logo.logoAlt }} />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/80">{site.footerBlurb}</p>
          {social.length > 0 && (
            <ul className="mt-6 flex gap-2" aria-label="Social media">
              {social.map(({ label, href, Icon }) => <li key={label}><a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 hover:bg-white/10"><Icon size={18} aria-hidden /></a></li>)}
            </ul>
          )}
        </div>
        <nav aria-label="Shop"><h2 className={col}>Shop</h2>
          <ul className="mt-4 space-y-2.5"><li><Link href="/shop" className={a}>All products</Link></li>
            {categories.map((c) => <li key={c.id}><Link href={`/shop?category=${c.slug}`} className={a}>{c.name}</Link></li>)}</ul></nav>
        <nav aria-label="Customer support"><h2 className={col}>Support</h2>
          <ul className="mt-4 space-y-2.5">{[["Track an order", "/track"], ["My account", "/account"], ["Delivery information", "/delivery-information"], ["FAQs", "/faqs"], ["Contact us", "/contact"], ["About Us", "/about"]].map(([l, h]) => <li key={h}><Link href={h} className={a}>{l}</Link></li>)}</ul></nav>
        <div><h2 className={col}>Contact</h2>
          {site.phone || site.email || site.address ? (
            <ul className="mt-4 space-y-3 text-sm text-white/85">
              {site.phone && <li className="flex gap-2.5"><Phone size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden /><a href={`tel:${site.phone.replace(/\s/g, "")}`} className="hover:underline">{site.phone}</a></li>}
              {site.email && <li className="flex gap-2.5"><Mail size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden /><a href={`mailto:${site.email}`} className="break-all hover:underline">{site.email}</a></li>}
              {site.address && <li className="flex gap-2.5"><MapPin size={16} className="mt-0.5 shrink-0 text-gold" aria-hidden /><span>{site.address}</span></li>}
            </ul>
          ) : <p className="mt-4 text-sm text-white/80">MeatBond Foods Processing Facility · Chandgaon, Chattogram. <Link href="/contact" className="font-semibold text-white underline underline-offset-4">Contact support</Link></p>}
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-5 text-xs text-white/75 sm:flex-row">
          <p>© {new Date().getFullYear()} MeatBond MART. A MeatBond Foods brand. 100% Halal &amp; Cold-Chain Certified.</p>
          <ul className="flex gap-5"><li><Link href="/privacy-policy" className="hover:text-white hover:underline">Privacy policy</Link></li><li><Link href="/terms" className="hover:text-white hover:underline">Terms &amp; conditions</Link></li></ul>
        </div>
      </div>
    </footer>
  );
}
