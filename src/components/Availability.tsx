import type { Availability as A } from "@/lib/domain/types";

const MAP: Record<A, { label: string; dot: string }> = {
  in_stock: { label: "In stock", dot: "bg-forest-light" },
  low_stock: { label: "Low stock", dot: "bg-amber-500" },
  out_of_stock: { label: "Out of stock", dot: "bg-clay" },
};

export function Availability({ value, compact = false }: { value: A; compact?: boolean }) {
  const m = MAP[value];
  return (
    <span className={`inline-flex items-center gap-1.5 ${compact ? "text-xs" : "text-sm"} text-charcoal/75`}>
      <span aria-hidden className={`h-2 w-2 rounded-full ${m.dot}`} />{m.label}
    </span>
  );
}
