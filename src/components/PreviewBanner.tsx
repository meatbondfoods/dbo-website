"use client";
import { useState } from "react";

/** Shown only while an admin is previewing unpublished DRAFT content (Next.js draft mode, dev only). */
export function PreviewBanner() {
  const [busy, setBusy] = useState(false);
  return (
    <div role="status" className="sticky top-0 z-[70] flex flex-wrap items-center justify-center gap-3 bg-gold px-4 py-2 text-sm font-semibold text-deep">
      Previewing unpublished draft content. Visitors cannot see this.
      <button disabled={busy} className="rounded-md bg-deep px-3 py-1 text-white" onClick={async () => { setBusy(true); await fetch("/api/admin/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ enable: false }) }); location.reload(); }}>Exit preview</button>
    </div>
  );
}
