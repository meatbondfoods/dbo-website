import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Snowflake, ShieldCheck, Truck, BadgeCheck } from "lucide-react";
import { getRepositories } from "@/lib/repositories";
import { ProductCard } from "@/components/ProductCard";
import { Newsletter } from "@/components/Newsletter";

export const dynamic = "force-dynamic";

const WHY = [
  { icon: Snowflake, title: "Chilled, never frozen", body: "Held at 0-4°C from processing to your door." },
  { icon: ShieldCheck, title: "Hygienically processed", body: "Cut, trimmed and packed in a controlled facility." },
  { icon: Truck, title: "Same-day Dhaka delivery", body: "Order by noon for delivery the same day." },
  { icon: BadgeCheck, title: "Traceable quality", body: "Every pack links back to its processing batch." },
];

const TESTIMONIALS = [
  { quote: "The chicken is noticeably fresher than the supermarket. Packaging is spotless.", name: "Nusrat J.", place: "Gulshan" },
  { quote: "Beef curry cut was perfectly trimmed and arrived properly chilled.", name: "Tanvir A.", place: "Dhanmondi" },
  { quote: "Easy ordering, accurate weights, and the delivery was right on time.", name: "Farzana H.", place: "Uttara" },
];

export default async function Home() {
  const { catalog } = getRepositories();
  const [categories, products] = await Promise.all([catalog.listCategories(), catalog.listProducts()]);
  const best = products.filter((p) => p.tags.includes("bestseller"));
  const featured = products.filter((p) => p.availability !== "out_of_stock").slice(0, 4);

  return (
    <>
      <section className="border-b border-line bg-cream-deep">
        <div className="container-page grid items-center gap-10 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="eyebrow">Premium meat &amp; poultry</p>
            <h1 className="mt-4 text-4xl leading-[1.1] sm:text-5xl lg:text-6xl">Honest meat, chilled to your door.</h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-charcoal/75">Fresh chicken, beef and mutton, processed daily by MeatBond Foods and delivered across Dhaka at proper cold-chain temperatures.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary">Shop now <ArrowRight size={16} /></Link>
              <Link href="/delivery-information" className="btn-outline">Delivery details</Link>
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-line">
            <Image src="/products/beef-curry-cut-1.svg" alt="Beef curry cut, sample product image" fill unoptimized priority className="object-cover" />
          </div>
        </div>
      </section>

      <section className="container-page pt-16" aria-labelledby="cats">
        <h2 id="cats" className="text-3xl">Shop by category</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.id} href={`/shop?category=${c.slug}`} className="group rounded-md border border-line bg-white p-5 transition-colors hover:border-forest">
              <h3 className="font-serif text-xl">{c.name}</h3>
              <p className="mt-2 text-sm text-charcoal/65">{c.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest">Browse <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page pt-16" aria-labelledby="feat">
        <div className="flex items-end justify-between"><h2 id="feat" className="text-3xl">Featured products</h2><Link href="/shop" className="text-sm font-medium text-forest underline-offset-4 hover:underline">View all</Link></div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">{featured.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>

      <section className="container-page pt-16" aria-labelledby="offer">
        <div className="grid overflow-hidden rounded-md bg-forest text-cream md:grid-cols-[1.2fr_1fr]">
          <div className="p-8 sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cream/70">Special offer</p>
            <h2 id="offer" className="mt-3 font-serif text-3xl text-cream">Free delivery over ৳1,500</h2>
            <p className="mt-3 max-w-md text-sm text-cream/75">Stock the freezer and skip the delivery charge on every order above ৳1,500.</p>
            <Link href="/shop" className="btn mt-6 bg-cream text-forest hover:bg-white">Start shopping</Link>
          </div>
          <div className="relative hidden min-h-[220px] md:block"><Image src="/products/whole-broiler-chicken-2.svg" alt="" fill unoptimized className="object-cover" /></div>
        </div>
      </section>

      <section className="container-page pt-16" aria-labelledby="best">
        <h2 id="best" className="text-3xl">Best sellers</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">{best.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      </section>

      <section className="container-page pt-16" aria-labelledby="why">
        <h2 id="why" className="text-3xl">Why choose MeatBond Mart</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map(({ icon: Icon, title, body }) => (
            <div key={title}><Icon className="text-forest" size={26} aria-hidden /><h3 className="mt-3 font-serif text-lg">{title}</h3><p className="mt-1 text-sm text-charcoal/70">{body}</p></div>
          ))}
        </div>
      </section>

      <section className="mt-16 bg-cream-deep py-14" aria-labelledby="quality">
        <div className="container-page grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="eyebrow">Quality &amp; freshness</p>
            <h2 id="quality" className="mt-3 text-3xl">From our facility to your kitchen</h2>
            <p className="mt-4 text-sm leading-relaxed text-charcoal/75">MeatBond Foods processes and packs every order in-house. Products are traced by batch, held in chilled storage and dispatched in temperature-controlled vans, so what arrives is as fresh as the day it was cut.</p>
          </div>
          <ul className="grid gap-3 text-sm">
            {["Daily processing, no long-term stock", "0-4°C cold chain end to end", "Batch traceability on every pack", "Weighed and packed to order"].map((t) => (
              <li key={t} className="flex items-center gap-3 rounded-md border border-line bg-white px-4 py-3"><BadgeCheck size={18} className="text-forest" aria-hidden />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-page py-16" aria-labelledby="reviews">
        <h2 id="reviews" className="text-3xl">What customers say</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="rounded-md border border-line bg-white p-6">
              <blockquote className="text-sm leading-relaxed text-charcoal/80">“{t.quote}”</blockquote>
              <figcaption className="mt-4 text-sm font-medium">{t.name}<span className="font-normal text-charcoal/55"> · {t.place}</span></figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-3 text-xs text-charcoal/50">Sample testimonials for the demo; replace with real customer reviews before launch.</p>
      </section>

      <Newsletter />
    </>
  );
}
