"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const STATUSES = ["pending_confirmation", "confirmed", "processing", "ready", "dispatched", "delivered", "on_hold", "rejected", "cancelled"];
const label = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

/** DEMO ONLY. In production the ERP owns the status; website admins never confirm or dispatch an order. */
export function OrderStatusControls({ reference, status }: { reference: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <section aria-labelledby="sim" className="rounded-xl border-2 border-dashed border-gold bg-white p-5">
      <h2 id="sim" className="text-lg">Demo: simulate ERP status</h2>
      <p className="mt-1 text-sm text-ink-soft">Stands in for ERP staff so you can see the customer&apos;s tracking timeline change. Not available in production, where the ERP controls status.</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div><label htmlFor="st" className="label">Status</label><select id="st" className="input" value={value} onChange={(e) => setValue(e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></div>
        <Button disabled={busy || value === status} onClick={async () => {
          setBusy(true); setMsg("");
          const res = await fetch(`/api/admin/orders/${encodeURIComponent(reference)}/simulate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: value }) });
          setMsg(res.ok ? "Status updated." : "Could not update."); setBusy(false); router.refresh();
        }}>Apply</Button>
      </div>
      {msg && <p role="status" className="mt-3 text-sm font-medium text-success">{msg}</p>}
    </section>
  );
}
