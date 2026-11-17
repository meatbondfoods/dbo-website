import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageContent } from "@/lib/content/server";
import { deliveryNote } from "@/lib/pricing";
import { PAGES } from "./content";

export const dynamicParams = false;
export const dynamic = "force-dynamic";
export function generateStaticParams() { return Object.keys(PAGES).map((page) => ({ page })); }

export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const p = PAGES[(await params).page];
  return { title: p?.title };
}

export default async function InfoPage({ params }: { params: Promise<{ page: string }> }) {
  const page = PAGES[(await params).page];
  if (!page) notFound();
  const [site, commerce] = await Promise.all([pageContent("site"), pageContent("commerce")]);

  // Tokens are replaced with admin-managed content so these pages never contradict the settings.
  const contact = [site.phone && `Phone: ${site.phone}`, site.email && `Email: ${site.email}`, site.address && `Address: ${site.address}`].filter(Boolean).join(" · ");
  const expand = (b: string) =>
    b === "{{DELIVERY_RULE}}" ? deliveryNote(commerce)
    : b === "{{CONTACT_DETAILS}}" ? (contact || "Phone, email and address details will be published here once confirmed by the business.")
    : b;

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl">{page.title}</h1>
      {page.intro && <p className="mt-3 text-base text-ink-soft">{page.intro}</p>}
      <div className="mt-8 space-y-8">
        {page.sections.map((s) => (
          <section key={s.heading}><h2 className="text-xl">{s.heading}</h2>
            <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-soft">{s.body.map((b) => <p key={b}>{expand(b)}</p>)}</div></section>
        ))}
      </div>
      {page.notice && <p className="mt-10 rounded-md border border-hairline bg-mint-light p-4 text-xs text-ink-soft">{page.notice}</p>}
    </div>
  );
}
