import Image from "next/image";
import { BadgeCheck, Package, Route, Scale, ShieldCheck, Snowflake, Star } from "lucide-react";
import { getStorefront, pageContent } from "@/lib/content/server";
import { deliverySummary } from "@/lib/pricing";
import { Hero } from "@/components/Hero";
import { CategoryCard } from "@/components/CategoryCard";
import { ProductGrid } from "@/components/ProductGrid";
import { Newsletter } from "@/components/Newsletter";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

const WHY = [
  { Icon: Snowflake, title: "Chilled handling", body: "Products are packed and dispatched chilled, ready for your fridge." },
  { Icon: Package, title: "Packed to order", body: "Weighed and packed by MeatBond Foods when you order." },
  { Icon: Route, title: "Track every order", body: "Follow your order from confirmation all the way to your door." },
  { Icon: Scale, title: "Clear pricing", body: "Prices and weights are shown up front, with no surprises at checkout." },
];

// SAMPLE CONTENT: replace with real customer reviews before launch.
const TESTIMONIALS = [
  { quote: "Fresh, neatly packed and the weights were accurate. Ordering was simple.", name: "Sample customer A", place: "Dhaka" },
  { quote: "Delivery arrived chilled and on the day promised. Will order again.", name: "Sample customer B", place: "Dhaka" },
  { quote: "Good variety of cuts and the order tracking page is genuinely useful.", name: "Sample customer C", place: "Dhaka" },
];

export default async function Home() {
  const [{ categories, visible: products, featured, best }, hero, commerce] = await Promise.all([getStorefront(), pageContent("hero"), pageContent("commerce")]);

  return (
    <>
      <Hero hero={hero} commerce={commerce} />

      <section className="container-page pt-20" aria-labelledby="cats">
        <SectionHeading id="cats" eyebrow="Categories" title="Shop by category" description="Sample categories for the demo catalogue." action={{ href: "/shop", label: "All products" }} />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => <CategoryCard key={c.id} category={c} count={products.filter((p) => p.categoryId === c.id).length} />)}
        </div>
      </section>

      <section className="container-page pt-20" aria-labelledby="feat">
        <SectionHeading id="feat" eyebrow="Fresh picks" title="Featured products" action={{ href: "/shop", label: "View all" }} />
        <div className="mt-8"><ProductGrid products={featured} /></div>
      </section>

      <section className="mt-20 bg-mint-light py-20" aria-labelledby="why">
        <div className="container-page">
          <SectionHeading id="why" eyebrow="Why MeatBond" title="Why choose MeatBond Mart" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map(({ Icon, title, body }) => (
              <div key={title} className="card p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-mint text-brand"><Icon size={24} aria-hidden /></span>
                <h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm text-ink-soft">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page grid items-center gap-10 pt-20 lg:grid-cols-2" aria-labelledby="quality">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-hairline shadow-soft">
          <Image src="/products/whole-broiler-chicken-2.svg" alt="Placeholder for a photograph of hygienic product handling" fill unoptimized sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
        </div>
        <div>
          <SectionHeading id="quality" eyebrow="Quality & freshness" title="Care at every step" description="MeatBond Foods processes and packs your order in-house, with careful handling from our facility to your kitchen." />
          <ul className="mt-6 space-y-3">
            {["Processed and packed by MeatBond Foods", "Weighed and checked before dispatch", "Chilled handling during delivery", "Order records kept for every sale"].map((t) => (
              <li key={t} className="flex items-center gap-3 rounded-xl border border-hairline bg-white px-4 py-3.5 text-sm font-medium"><BadgeCheck size={20} className="shrink-0 text-success" aria-hidden />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page pt-20" aria-labelledby="best">
        <SectionHeading id="best" eyebrow="Customer favourites" title="Best sellers" action={{ href: "/shop", label: "Shop all" }} />
        <div className="mt-8"><ProductGrid products={best} /></div>
      </section>

      <section className="container-page pt-20" aria-labelledby="promo">
        <div className="on-dark relative overflow-hidden rounded-2xl bg-deep px-6 py-12 text-white sm:px-12 sm:py-14">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-gold/40" aria-hidden />
          <div className="absolute -right-6 -top-6 h-44 w-44 rounded-full border border-gold/25" aria-hidden />
          <div className="relative max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">Special offer</p>
            <h2 id="promo" className="mt-3 text-3xl text-white sm:text-4xl">Free delivery within {commerce.freeRadiusKm} km</h2>
            <p className="mt-3 text-white/80">{deliverySummary(commerce)}. Calculated automatically at checkout from your delivery area.</p>
            <ButtonLink href="/shop" variant="gold" className="mt-7 px-7">Start shopping</ButtonLink>
          </div>
        </div>
      </section>

      <section className="container-page pt-20" aria-labelledby="reviews">
        <SectionHeading id="reviews" eyebrow="Reviews" title="What customers say" description="Demo content: sample reviews shown until real customer reviews are collected." />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="card flex flex-col p-6">
              <div className="flex items-center justify-between"><span className="flex" aria-label="5 out of 5 stars">{[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} className="fill-gold text-gold" aria-hidden />)}</span><span className="rounded-md bg-mint px-2 py-0.5 text-[11px] font-bold uppercase text-deep">Demo</span></div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink">“{t.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-hairline pt-4 text-sm"><ShieldCheck size={18} className="text-leaf" aria-hidden /><span className="font-semibold">{t.name}<span className="font-normal text-ink-soft"> · {t.place}</span></span></figcaption>
            </figure>
          ))}
        </div>
      </section>

      <Newsletter />
    </>
  );
}
