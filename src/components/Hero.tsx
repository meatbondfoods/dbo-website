import Image from "next/image";
import { ShieldCheck, Snowflake, Truck } from "lucide-react";
import type { ContentMap, DeliveryConfig } from "@/lib/content/schema";
import { ButtonLink } from "./ui/Button";

const ICONS = [Snowflake, Truck, ShieldCheck, ShieldCheck];

export function Hero({ hero, commerce }: { hero: ContentMap["hero"]; commerce: DeliveryConfig }) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-mint-light">
      <div className="container-page grid items-center gap-10 py-12 md:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
        <div>
          {hero.eyebrow && <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-leaf shadow-soft"><span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />{hero.eyebrow}</p>}
          <h1 id="hero-title" className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-[3.5rem]">{hero.headline}</h1>
          {hero.subheadline && <p className="mt-5 max-w-xl text-lg text-ink-soft">{hero.subheadline}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={hero.primaryHref} className="px-7">{hero.primaryLabel}</ButtonLink>
            {hero.secondaryLabel && hero.secondaryHref && <ButtonLink href={hero.secondaryHref} variant="outline" className="px-7">{hero.secondaryLabel}</ButtonLink>}
          </div>
          {hero.trustItems.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 border-t border-brand/15 pt-6">
              {hero.trustItems.map((label, i) => { const Icon = ICONS[i % ICONS.length]; return <li key={label} className="flex items-center gap-2 text-sm font-semibold text-deep"><Icon size={18} className="text-leaf" aria-hidden />{label}</li>; })}
            </ul>
          )}
        </div>
        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-hairline bg-white shadow-lift">
            <Image src={hero.imagePath} alt={hero.imageAlt} fill unoptimized priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
          </div>
          {commerce.active && commerce.freeRadiusKm > 0 && (
            <div className="absolute -bottom-4 left-4 hidden rounded-xl border border-hairline bg-white px-4 py-3 shadow-lift sm:block">
              <p className="text-xs text-ink-soft">Delivery</p><p className="text-sm font-bold text-deep">Free within {commerce.freeRadiusKm} km</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
