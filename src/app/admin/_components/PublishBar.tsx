"use client";
import { Button } from "@/components/ui/Button";

export interface Msg { type: "ok" | "error"; text: string }

/** Shared draft / preview / publish controls. The live site only changes when "Publish" succeeds. */
export function PublishBar({ unpublished, version, busy, msg, blockReason, onSave, onPreview, onPublish, onDiscard }: {
  unpublished: boolean; version: number; busy: boolean; msg: Msg | null; blockReason?: string;
  onSave: () => void; onPreview: () => void; onPublish: () => void; onDiscard: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-hairline bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${unpublished ? "bg-gold text-deep" : "bg-mint text-deep"}`}>
          <span className={`h-2 w-2 rounded-full ${unpublished ? "bg-deep" : "bg-success"}`} aria-hidden />
          {unpublished ? "Unpublished changes" : "Live site is up to date"}
        </span>
        <span className="text-xs text-ink-soft">{version > 0 ? `Published version ${version}` : "Never published (using built-in defaults)"}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy || !unpublished} onClick={onDiscard}>Discard draft</Button>
          <Button variant="outline" disabled={busy} onClick={onSave}>Save draft</Button>
          <Button variant="outline" disabled={busy} onClick={onPreview}>Preview draft</Button>
          <Button disabled={busy || !unpublished || !!blockReason} onClick={onPublish} title={blockReason}>Publish</Button>
        </div>
      </div>
      {blockReason && unpublished && <p className="mt-2 text-xs font-medium text-danger">Publishing blocked: {blockReason}</p>}
      {msg && <p role={msg.type === "error" ? "alert" : "status"} className={`mt-2 text-sm font-medium ${msg.type === "error" ? "text-danger" : "text-success"}`}>{msg.text}</p>}
    </div>
  );
}
