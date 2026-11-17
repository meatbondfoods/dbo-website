import Link from "next/link";
import { Wordmark } from "./Wordmark";

const COLS = [
  { title: "Shop", links: [["All products", "/shop"], ["Fresh chicken", "/shop?category=chicken"], ["Beef", "/shop?category=beef"], ["Mutton", "/shop?category=mutton"], ["Processed foods", "/shop?category=processed"]] },
  { title: "Help", links: [["Track an order", "/track"], ["Delivery information", "/delivery-information"], ["FAQs", "/faqs"], ["Contact us", "/contact"]] },
  { title: "Company", links: [["About MeatBond Foods", "/about"], ["Privacy policy", "/privacy-policy"], ["Terms & conditions", "/terms"]] },
];

export function Footer() {
  return (
    <footer className="mt-20 bg-forest-dark text-cream">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Wordmark light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/70">Premium meat &amp; poultry shopping. A MeatBond Foods brand, processed and chilled with care.</p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-cream/60">{c.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={href}><Link href={href} className="text-sm text-cream/85 transition-colors hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-cream/10 py-5 text-center text-xs text-cream/55">© {new Date().getFullYear()} MeatBond Mart. All rights reserved.</div>
    </footer>
  );
}
