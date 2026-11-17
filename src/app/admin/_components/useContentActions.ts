"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentKey } from "@/lib/content/schema";
import type { Msg } from "./PublishBar";

/** Shared client logic for save / preview / publish / discard / rollback against the admin API. */
export function useContentActions(contentKey: ContentKey) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const url = `/api/admin/content/${contentKey}`;

  async function call(path: string, method: string, body?: unknown) {
    const res = await fetch(path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { res, data: await res.json().catch(() => ({})) };
  }

  async function save(values: unknown): Promise<boolean> {
    setBusy(true); setMsg(null); setFieldErrors({});
    try {
      const { res, data } = await call(url, "PUT", values);
      if (!res.ok) { setFieldErrors(data.details?.fieldErrors ?? {}); setMsg({ type: "error", text: data.error === "Invalid content" ? "Some fields are invalid. See the messages below." : data.error ?? "Could not save." }); return false; }
      setMsg({ type: "ok", text: "Draft saved. The live site is unchanged until you publish." }); router.refresh(); return true;
    } catch { setMsg({ type: "error", text: "Network problem. Nothing was saved." }); return false; } finally { setBusy(false); }
  }

  async function preview(values: unknown) {
    if (!(await save(values))) return;
    await call("/api/admin/preview", "POST", { enable: true });
    window.open("/", "_blank", "noopener");
  }

  async function publish(values: unknown) {
    if (!(await save(values))) return;
    setBusy(true);
    try {
      const { res, data } = await call(`${url}/publish`, "POST");
      setMsg(res.ok ? { type: "ok", text: `Published as version ${data.version}. The live site is updated.` } : { type: "error", text: data.error ?? "Could not publish." });
      router.refresh();
    } finally { setBusy(false); }
  }

  async function discard() {
    setBusy(true);
    try { await call(url, "DELETE"); setMsg({ type: "ok", text: "Draft discarded." }); router.refresh(); } finally { setBusy(false); }
  }

  async function rollback(version: number) {
    setBusy(true);
    try {
      const { res, data } = await call(`${url}/rollback`, "POST", { version });
      setMsg(res.ok ? { type: "ok", text: `Rolled back: version ${version} is live again (saved as version ${data.version}).` } : { type: "error", text: data.error ?? "Could not roll back." });
      router.refresh();
    } finally { setBusy(false); }
  }

  return { busy, msg, fieldErrors, save, preview, publish, discard, rollback };
}
