import Image from "next/image";
import { BadgeCheck, Package, Route, Scale, ShieldCheck, Snowflake, Star } from "lucide-react";
import { getStorefront, pageContent } from "@/lib/content/server";
import { Hero } from "@/components/Hero";
import { CategoryCard } from "@/components/CategoryCard";
import { ProductGrid } from "@/components/ProductGrid";
import { Newsletter } from "@/components/Newsletter";
import { QualityVideoPlayer } from "@/components/QualityVideoPlayer";
import { ButtonLink } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Category } from "@/lib/domain/types";

const WHY = [
  { Icon: Snowflake, title: "Cold-Chain Integrity", body: "Temperature-controlled chilled packing and dispatch straight to your kitchen." },
  { Icon: Package, title: "Packed Fresh to Order", body: "Strictly weighed, hand-cut, and sealed by MeatBond Foods upon order." },
  { Icon: Route, title: "Real-Time Order Tracking", body: "Follow your order from dispatch to your doorstep with live status." },
  { Icon: Scale, title: "100% Halal & Clear Pricing", body: "Certified halal, exact weights, and upfront prices with zero hidden markups." },
];

const ALL_DEPARTMENTS: Category[] = [
  { id: "cat-cuts", slug: "chicken-cuts", name: "Fresh Poultry Cuts", description: "Boneless breast fillets, drumsticks and everyday chicken cuts." },
  { id: "cat-beef", slug: "other-meat", name: "Premium Beef Cuts", description: "Traditional curry cuts, tender beef mince and slow-cook portions." },
  { id: "cat-mutton", slug: "other-meat", name: "Tender Mutton", description: "Selected leg pieces & rich cuts, perfect for slow cooking." },
  { id: "cat-processed", slug: "processed-meat", name: "Processed & Ready-to-Cook", description: "Smoked chicken sausages, spiced seekh kebabs & patties." },
  { id: "cat-whole", slug: "whole-chicken", name: "Cleaned Whole Chicken", description: "Whole broiler & Sonali birds, dressed and ready to roast." },
  { id: "cat-bbq", slug: "chicken-cuts", name: "Marinated & BBQ Specials", description: "Chef-prepared marinades, seasoned tikka & grill cuts." },
];

const TESTIMONIALS = [
  { quote: "Fresh, hygienically vacuum-sealed, and the pack weights were spot on. Ordering took less than two minutes.", name: "Tasnim Rahman", place: "Halishahar, Chattogram" },
  { quote: "Delivered properly chilled in insulated packaging right on schedule. Much cleaner and more convenient than the wet market.", name: "Kamrul Hasan", place: "Nasirabad, Chattogram" },
  { quote: "Great selection of cuts, transparent prices with special offers, and live order tracking keeps me updated.", name: "Nusrat Jahan", place: "Chandgaon, Chattogram" },
];

export default async function Home() {
  const [{ categories, visible: products, featured, best }, hero, commerce, banners, sections] = await Promise.all([
    getStorefront(), pageContent("hero"), pageContent("commerce"), pageContent("banners"), pageContent("sections"),
  ]);
  const activeBanners = banners.items.filter((b) => b.active);

  // Each section is rendered from the admin-managed order and visibility; `t` is the optional heading override.
  const render: Record<string, (t: string) => React.ReactNode> = {
    categories: (t) => {
      const departmentList = categories.length >= 5
        ? categories
        : ALL_DEPARTMENTS.map((dept) => {
            const match = categories.find((c) => c.slug === dept.slug || c.id === dept.id);
            return match ? { ...dept, name: match.name || dept.name } : dept;
          });

      return (
        <section key="categories" className="container-page pt-20" aria-labelledby="cats">
          <SectionHeading
            id="cats"
            eyebrow="Marketplace Departments"
            title={t || "Shop by category"}
            description="Explore our range of farm-fresh poultry, premium beef cuts, tender mutton, and ready-to-cook specialties."
            action={{ href: "/shop", label: "All products" }}
          />
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {departmentList.map((c) => (
              <CategoryCard
                key={c.id + c.slug}
                category={c}
                count={products.filter((p) => p.categoryId === c.id || p.categoryId === c.slug).length}
              />
            ))}
          </div>
        </section>
      );
    },
    featured: (t) => featured.length === 0 ? null : (
      <section key="featured" className="container-page pt-20" aria-labelledby="feat">
        <SectionHeading id="feat" eyebrow="Fresh picks" title={t || "Featured products"} action={{ href: "/shop", label: "View all" }} />
        <div className="mt-8"><ProductGrid products={featured} /></div>
      </section>
    ),
    why: (t) => (
      <section key="why" className="mt-20 bg-mint-light/60 py-20 border-y border-hairline/60" aria-labelledby="why">
        <div className="container-page">
          <SectionHeading id="why" eyebrow="The MeatBond Standard" title={t || "Why choose MeatBond Mart"} description="Quality, food safety, and cold-chain precision in every single order." />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map(({ Icon, title, body }) => (
              <div key={title} className="card p-6 sm:p-7 bg-white rounded-2xl shadow-soft hover:-translate-y-1 hover:shadow-lift transition-all duration-300 border border-hairline/80">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint/70 text-brand shadow-sm"><Icon size={26} aria-hidden /></span>
                <h3 className="mt-5 text-lg font-bold text-deep leading-snug">{title}</h3>
                <p className="mt-2 text-sm text-ink-soft leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),
    quality: (t) => (
      <section key="quality" className="container-page grid items-center gap-10 pt-20 lg:grid-cols-2" aria-labelledby="quality">
        <QualityVideoPlayer />
        <div>
          <SectionHeading id="quality" eyebrow="Quality & freshness" title={t || "Care at every step"} description="MeatBond Foods processes and packs your order in-house, with rigorous cold-chain handling from our facility to your kitchen." />
          <ul className="mt-6 space-y-3.5">
            {["100% Halal certified processing by MeatBond Foods", "Weighed, cut, and sealed fresh to order", "Chilled insulated handling during delivery", "Full digital order records kept for every purchase"].map((x) => (
              <li key={x} className="flex items-center gap-3 rounded-2xl border border-hairline bg-white px-5 py-4 text-sm font-semibold shadow-soft text-deep">
                <BadgeCheck size={22} className="shrink-0 text-success" aria-hidden />
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8">
            <ButtonLink href="/shop" variant="primary" className="px-7 py-3.5 font-bold shadow-lift">
              See How We Prepare Your Chicken
            </ButtonLink>
          </div>
        </div>
      </section>
    ),
    best: (t) => best.length === 0 ? null : (
      <section key="best" className="container-page pt-20" aria-labelledby="best">
        <SectionHeading id="best" eyebrow="Customer favourites" title={t || "Best sellers"} action={{ href: "/shop", label: "Shop all" }} />
        <div className="mt-8"><ProductGrid products={best} /></div>
      </section>
    ),
    banner: () => activeBanners.length === 0 ? null : (
      <section key="banner" className="container-page space-y-5 pt-20" aria-label="Promotions">
        {activeBanners.map((b) => (
          <div key={b.id} className="on-dark relative overflow-hidden rounded-2xl bg-deep text-white md:grid md:grid-cols-[1.2fr_1fr] shadow-lift">
            <div className="relative px-6 py-12 sm:px-12 sm:py-14">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gold">Featured Special</p>
              <h2 className="mt-3 text-3xl text-white sm:text-4xl font-extrabold">{b.title}</h2>
              {b.text && <p className="mt-3 max-w-xl text-white/85 leading-relaxed">{b.text}</p>}
              {b.ctaLabel && b.ctaHref && <ButtonLink href={b.ctaHref} variant="gold" className="mt-7 px-8 py-3.5 font-bold shadow-lift">{b.ctaLabel}</ButtonLink>}
            </div>
            {b.imagePath && <div className="relative hidden min-h-[240px] md:block"><Image src={b.imagePath} alt="" fill unoptimized className="object-cover" /></div>}
          </div>
        ))}
      </section>
    ),
    reviews: (t) => (
      <section key="reviews" className="container-page pt-20" aria-labelledby="reviews">
        <SectionHeading id="reviews" eyebrow="Verified Feedback" title={t || "What customers say"} description="Real feedback from families and kitchens enjoying MeatBond Mart." />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((x) => (
            <figure key={x.name} className="card flex flex-col p-6 sm:p-7 rounded-2xl border border-hairline bg-white shadow-soft hover:-translate-y-0.5 hover:shadow-lift transition-all">
              <div className="flex items-center justify-between">
                <span className="flex" aria-label="5 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((i) => <Star key={i} size={16} className="fill-gold text-gold" aria-hidden />)}
                </span>
                <span className="rounded-full bg-mint/70 px-2.5 py-0.5 text-[11px] font-bold uppercase text-deep border border-brand/10">Verified Customer</span>
              </div>
              <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink">“{x.quote}”</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-hairline pt-4 text-sm">
                <ShieldCheck size={18} className="text-leaf" aria-hidden />
                <span className="font-semibold">{x.name}<span className="font-normal text-ink-soft"> · {x.place}</span></span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    ),
    newsletter: () => <Newsletter key="newsletter" />,
  };

  return (
    <>
      <Hero hero={hero} commerce={commerce} />
      {sections.items.filter((s) => s.visible).map((s) => render[s.id]?.(s.title))}
      {!sections.items.some((s) => s.id === "newsletter" && s.visible) && <div className="pb-8" />}
    </>
  );
}
