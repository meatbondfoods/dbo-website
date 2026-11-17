"use client";
import { Minus, Plus } from "lucide-react";

export function QuantitySelector({ value, onChange, label, min = 1, max = 50, size = "md" }: {
  value: number; onChange: (n: number) => void; label: string; min?: number; max?: number; size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-lg border border-ink-soft bg-white">
      <button type="button" aria-label={`Decrease quantity of ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}
        className={`${pad} flex items-center justify-center rounded-l-lg text-brand hover:bg-mint-light disabled:text-ink-soft/50 disabled:hover:bg-transparent`}><Minus size={16} aria-hidden /></button>
      <span className="min-w-8 px-1 text-center text-sm font-semibold tabular-nums" aria-live="polite">{value}</span>
      <button type="button" aria-label={`Increase quantity of ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}
        className={`${pad} flex items-center justify-center rounded-r-lg text-brand hover:bg-mint-light disabled:text-ink-soft/50 disabled:hover:bg-transparent`}><Plus size={16} aria-hidden /></button>
    </div>
  );
}
