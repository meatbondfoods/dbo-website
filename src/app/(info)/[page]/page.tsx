import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGES } from "./content";

export const dynamicParams = false;
export function generateStaticParams() { return Object.keys(PAGES).map((page) => ({ page })); }

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const p = PAGES[(await params).page];
  return { title: p?.title };
}

export default async function InfoPage({ params }: { params: Promise<{ page: string }> }) {
  const page = PAGES[(await params).page];
  if (!page) notFound();
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl">{page.title}</h1>
      {page.intro && <p className="mt-3 text-base text-charcoal/70">{page.intro}</p>}
      <div className="mt-8 space-y-8">
        {page.sections.map((s) => (
          <section key={s.heading}><h2 className="text-xl">{s.heading}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-charcoal/80">{s.body.map((b) => <p key={b}>{b}</p>)}</div></section>
        ))}
      </div>
      {page.notice && <p className="mt-10 rounded-md border border-line bg-cream-deep p-4 text-xs text-charcoal/60">{page.notice}</p>}
    </div>
  );
}
