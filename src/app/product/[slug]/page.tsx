import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Snowflake, Truck, Wallet } from "lucide-react";
import { getRepositories } from "@/lib/repositories";
import { ProductGrid } from "@/components/ProductGrid";
import { Stars } from "@/components/Stars";
import { Availability } from "@/components/Availability";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Gallery } from "./Gallery";
import { Purchase } from "./Purchase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getRepositories().catalog.getProductBySlug((await params).slug);
  return { title: p?.name ?? "Product", description: p?.description };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { catalog } = getRepositories();
  const product = await catalog.getProductBySlug((await params).slug);
  if (!product) notFound();
  const [categories, all] = await Promise.all([catalog.listCategories(), catalog.listProducts()]);
  const category = categories.find((c) => c.id === product.categoryId);
  const related = all.filter((p) => p.categoryId === product.categoryId && p.id !== product.id).slice(0, 4);
  const crumb = "text-ink-soft hover:text-brand hover:underline";

  return (
    <div className="container-page py-8 sm:py-10">
      <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-1.5 text-sm">
        <li><Link href="/shop" className={crumb}>Shop</Link></li><ChevronRight size={14} className="text-ink-soft" aria-hidden />
        {category && <><li><Link href={`/shop?category=${category.slug}`} className={crumb}>{category.name}</Link></li><ChevronRight size={14} className="text-ink-soft" aria-hidden /></>}
        <li aria-current="page" className="font-semibold text-deep">{product.name}</li>
      </ol></nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Gallery images={product.images} name={product.name} />
        <div>
          <h1 className="text-3xl sm:text-4xl">{product.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2"><Stars rating={product.rating} count={product.reviewCount} /><Availability value={product.availability} /></div>
          <p className="mt-5 text-base text-ink-soft">{product.description}</p>
          <Purchase product={product} />
          <ul className="mt-8 grid gap-3 border-t border-hairline pt-6 text-sm">
            {[[Snowflake, "Packed and dispatched chilled"], [Truck, "Free delivery on orders over ৳1,500"], [Wallet, "Cash on delivery available"]].map(([I, t]) => {
              const Icon = I as typeof Snowflake; return <li key={t as string} className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-mint-light text-brand"><Icon size={18} aria-hidden /></span>{t as string}</li>;
            })}
          </ul>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20" aria-labelledby="rel">
          <SectionHeading id="rel" eyebrow="Related" title="You may also like" />
          <div className="mt-8"><ProductGrid products={related} /></div>
        </section>
      )}
    </div>
  );
}
