import Image from "next/image";
import { ShieldCheck, Snowflake, Truck } from "lucide-react";
import { ButtonLink } from "./ui/Button";

const TRUST = [
  { Icon: Snowflake, label: "Chilled delivery" },
  { Icon: Truck, label: "Cash on delivery" },
  { Icon: ShieldCheck, label: "Live order tracking" },
];

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-mint-light">
      <div className="container-page grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-leaf shadow-soft"><span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />MeatBond Foods</p>
          <h1 id="hero-title" className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.5rem]">Fresh poultry &amp; quality meat, delivered with care.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">Premium chicken, processed products and everyday meat from MeatBond Foods, packed to order and delivered chilled across Dhaka.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/shop" className="px-7">Shop now</ButtonLink>
            <ButtonLink href="/shop?category=chicken-cuts" variant="outline" className="px-7">Explore products</ButtonLink>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-brand/15 pt-6">
            {TRUST.map(({ Icon, label }) => <li key={label} className="flex items-center gap-2 text-sm font-semibold text-deep"><Icon size={18} className="text-leaf" aria-hidden />{label}</li>)}
          </ul>
        </div>
        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-hairline bg-white shadow-lift">
            <Image src="/products/hero.svg" alt="Placeholder for the hero photograph of fresh poultry" fill unoptimized priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
          </div>
          <div className="absolute -bottom-4 left-4 hidden rounded-xl border border-hairline bg-white px-4 py-3 shadow-lift sm:block">
            <p className="text-xs text-ink-soft">Delivery charge</p><p className="text-sm font-bold text-deep">Free over ৳1,500</p>
          </div>
        </div>
      </div>
    </section>
  );
}
