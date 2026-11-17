import Link from "next/link";

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" aria-label="MeatBond Mart home" className="inline-flex items-baseline gap-1.5">
      <span className={`font-serif text-2xl font-semibold tracking-tight ${light ? "text-cream" : "text-forest"}`}>MeatBond</span>
      <span className={`text-[0.7rem] font-semibold uppercase tracking-[0.28em] ${light ? "text-cream/70" : "text-clay"}`}>Mart</span>
    </Link>
  );
}
