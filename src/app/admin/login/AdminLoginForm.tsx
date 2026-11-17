"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextInput } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";

export function AdminLoginForm() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const v = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: v.email, password: v.password }) });
    if (r.ok) { router.push("/admin"); router.refresh(); return; }
    const d = await r.json().catch(() => ({})); setErr(d.error ?? "Could not sign in."); setBusy(false);
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextInput label="Email" name="email" type="email" required autoComplete="username" />
      <TextInput label="Password" name="password" type="password" required autoComplete="current-password" />
      {err && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm font-medium text-danger">{err}</p>}
      <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
