"use client";
import { useState } from "react";

/** Image field: shows the current image, accepts a path/URL, and uploads a new file (PNG / JPEG / WebP, up to 2 MB). */
export function ImageInput({ id, value, onChange, describedBy }: { id: string; value: string; onChange: (v: string) => void; describedBy?: string }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
    setBusy(true); setErr("");
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await fetch("/api/admin/upload", { method: "POST", body: fd }); const d = await r.json().catch(() => ({}));
      if (r.ok) onChange(d.path); else setErr(d.error ?? "Upload failed.");
    } catch { setErr("Network problem. Upload failed."); }
    setBusy(false);
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-hairline bg-mint-light text-xs text-ink-soft">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Current image preview" className="h-full w-full object-cover" />
          ) : "No image"}
        </div>
        <div className="min-w-[200px] flex-1 space-y-2">
          <input id={id} aria-describedby={describedBy} className="input" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} placeholder="/uploads/… or https://…" />
          <label className={`btn-outline cursor-pointer ${busy ? "opacity-60" : ""}`}>{busy ? "Uploading…" : "Upload image"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={upload} data-testid="image-upload" /></label>
        </div>
      </div>
      {err && <p role="alert" className="mt-2 text-sm font-medium text-danger">{err}</p>}
    </div>
  );
}
