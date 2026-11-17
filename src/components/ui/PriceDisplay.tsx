import { taka } from "@/lib/format";

const SIZE = { sm: "text-base", md: "text-xl", lg: "text-3xl" } as const;

export function PriceDisplay({ amount, compareAt, prefix, size = "md" }: { amount: number; compareAt?: number; prefix?: string; size?: keyof typeof SIZE }) {
  return (
    <p className="flex items-baseline gap-2">
      {prefix && <span className="text-sm text-ink-soft">{prefix}</span>}
      <span className={`${SIZE[size]} font-bold tracking-tight text-deep`}>{taka(amount)}</span>
      {compareAt && compareAt > amount && <s className="text-sm text-ink-soft"><span className="sr-only">Was </span>{taka(compareAt)}</s>}
    </p>
  );
}
