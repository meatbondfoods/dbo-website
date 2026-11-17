import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeading({ id, eyebrow, title, description, action, tone = "light" }: {
  id?: string; eyebrow?: string; title: string; description?: string; action?: { href: string; label: string }; tone?: "light" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && <p className={dark ? "text-xs font-bold uppercase tracking-[0.16em] text-gold" : "eyebrow"}>{eyebrow}</p>}
        <h2 id={id} className={`mt-2 text-3xl sm:text-4xl ${dark ? "text-white" : ""}`}>{title}</h2>
        {description && <p className={`mt-3 text-base ${dark ? "text-white/80" : "text-ink-soft"}`}>{description}</p>}
      </div>
      {action && (
        <Link href={action.href} className={`inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline ${dark ? "text-white" : "text-brand"}`}>
          {action.label} <ArrowRight size={16} aria-hidden />
        </Link>
      )}
    </div>
  );
}
