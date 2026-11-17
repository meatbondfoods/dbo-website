import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import type { Availability as A } from "@/lib/domain/types";

// Status is conveyed by icon AND text, never colour alone.
const MAP: Record<A, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  in_stock: { label: "In stock", cls: "text-success", Icon: CheckCircle2 },
  low_stock: { label: "Low stock", cls: "text-[#8A5A00]", Icon: AlertCircle },
  out_of_stock: { label: "Out of stock", cls: "text-danger", Icon: XCircle },
};

export function Availability({ value, compact = false }: { value: A; compact?: boolean }) {
  const { label, cls, Icon } = MAP[value];
  return <span className={`inline-flex items-center gap-1.5 font-medium ${compact ? "text-xs" : "text-sm"} ${cls}`}><Icon size={compact ? 14 : 16} aria-hidden />{label}</span>;
}
