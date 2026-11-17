import { Star } from "lucide-react";

export function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-charcoal/70" aria-label={`Rated ${rating} out of 5`}>
      <Star size={14} className="fill-clay text-clay" aria-hidden />
      <span className="font-medium text-charcoal">{rating.toFixed(1)}</span>
      {count !== undefined && <span>({count})</span>}
    </span>
  );
}
