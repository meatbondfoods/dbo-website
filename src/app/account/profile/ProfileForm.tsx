"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const [fe, setFe] = useState<Record<string, string[]>>({});
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true); setMsg(null); setFe({});
    const r = await fetch("/api/account/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: v.fullName, phone: v.phone }) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: "Profile saved." }); router.refresh(); } else { setFe(d.details?.fieldErrors ?? {}); setMsg({ ok: false, text: d.error ?? "Could not save." }); }
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextInput label="Full name" name="fullName" defaultValue={fullName} required autoComplete="name" error={fe.fullName?.[0]} />
      <TextInput label="Mobile number" name="phone" defaultValue={phone} inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" error={fe.phone?.[0]} />
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm font-medium ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
      <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
    </form>
  );
}
