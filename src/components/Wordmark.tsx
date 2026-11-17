import Link from "next/link";

/** MeatBond Mart wordmark: a deep-green monogram tile with a gold accent, plus the name set in Inter. */
export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" aria-label="MeatBond Mart, home" className="inline-flex items-center gap-2.5">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden className="shrink-0">
        <rect width="36" height="36" rx="9" fill={light ? "#FFFFFF" : "#124C32"} />
        <path d="M9 26V11.5l4.5 6.5 4.5-6.5V26" fill="none" stroke={light ? "#124C32" : "#FFFFFF"} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20.5 26l3.2-7.2L27 26" fill="none" stroke="#D6AD45" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="leading-none">
        <span className={`block text-[1.15rem] font-extrabold tracking-tight ${light ? "text-white" : "text-deep"}`}>MeatBond</span>
        <span className={`block pt-0.5 text-[0.62rem] font-bold uppercase tracking-[0.34em] ${light ? "text-gold" : "text-leaf"}`}>Mart</span>
      </span>
    </Link>
  );
}
