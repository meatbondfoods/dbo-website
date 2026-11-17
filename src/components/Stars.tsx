import { Star } from "lucide-react";

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-ink-soft">
      <Star size={15} className="fill-gold text-gold" aria-hidden />
      <span className="font-semibold text-ink">{rating.toFixed(1)}</span>
      <span className="sr-only"> out of 5</span>
      {count !== undefined && <span aria-label={`${count} reviews`}>({count})</span>}
    </span>
  );
}
