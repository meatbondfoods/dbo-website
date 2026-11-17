import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getRepositories } from "@/lib/repositories";
import { ProductCard } from "@/components/ProductCard";
import { Stars } from "@/components/Stars";
import { Availability } from "@/components/Availability";
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

  return (
    <div className="container-page py-8">
      <nav aria-label="Breadcrumb" className="text-sm text-charcoal/60">
        <Link href="/shop" className="hover:text-forest">Shop</Link> / {category && <Link href={`/shop?category=${category.slug}`} className="hover:text-forest">{category.name}</Link>} / <span className="text-charcoal">{product.name}</span>
      </nav>
      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <Gallery images={product.images} name={product.name} />
        <div>
          <h1 className="text-3xl sm:text-4xl">{product.name}</h1>
          <div className="mt-3 flex items-center gap-4"><Stars rating={product.rating} count={product.reviewCount} /><Availability value={product.availability} /></div>
          <p className="mt-5 text-sm leading-relaxed text-charcoal/75">{product.description}</p>
          <Purchase product={product} />
          <ul className="mt-8 space-y-2 border-t border-line pt-6 text-sm text-charcoal/70">
            <li>Chilled at 0-4°C, packed to order</li><li>Free delivery on orders over ৳1,500</li><li>Cash on delivery available</li>
          </ul>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="rel">
          <h2 id="rel" className="text-2xl">You may also like</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </div>
  );
}
