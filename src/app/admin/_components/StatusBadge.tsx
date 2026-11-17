import { CheckCircle2, CircleDashed, Clock, Truck, XCircle } from "lucide-react";

const MAP: Record<string, { label: string; cls: string; Icon: typeof Clock }> = {
  pending_confirmation: { label: "Pending confirmation", cls: "bg-gold/25 text-deep", Icon: Clock },
  confirmed: { label: "Confirmed", cls: "bg-mint text-deep", Icon: CheckCircle2 },
  processing: { label: "Processing", cls: "bg-mint text-deep", Icon: CircleDashed },
  ready: { label: "Ready", cls: "bg-mint text-deep", Icon: CheckCircle2 },
  dispatched: { label: "Dispatched", cls: "bg-mint text-deep", Icon: Truck },
  delivered: { label: "Delivered", cls: "bg-success text-white", Icon: CheckCircle2 },
  rejected: { label: "Rejected", cls: "bg-danger/10 text-danger", Icon: XCircle },
  cancelled: { label: "Cancelled", cls: "bg-danger/10 text-danger", Icon: XCircle },
};

// Always icon + text, never colour alone.
export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, cls: "bg-canvas text-ink", Icon: Clock };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${m.cls}`}><m.Icon size={13} aria-hidden />{m.label}</span>;
}
