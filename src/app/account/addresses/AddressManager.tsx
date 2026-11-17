"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import type { AddressDto } from "@/lib/auth/types";
import { TextArea, TextInput } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";

export function AddressManager({ initial, defaultName, defaultPhone }: { initial: AddressDto[]; defaultName: string; defaultPhone: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<AddressDto | "new" | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(""); const [fe, setFe] = useState<Record<string, string[]>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function call(url: string, method: string, body?: unknown) {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const f = new FormData(e.currentTarget);
    const g = (k: string) => String(f.get(k) ?? "");
    const body = { fullName: g("fullName"), phone: g("phone"), line1: g("line1"), area: g("area"), city: g("city"), postalCode: g("postalCode"), instructions: g("instructions"), isDefault: f.get("isDefault") === "on" };
    setBusy(true); setMsg(""); setFe({});
    const r = editing === "new" ? await call("/api/account/addresses", "POST", body) : await call(`/api/account/addresses/${(editing as AddressDto).id}`, "PUT", body);
    setBusy(false);
    if (r.ok) { setEditing(null); setMsg("Address saved."); router.refresh(); } else { setFe(r.data.details?.fieldErrors ?? {}); setMsg(r.data.error === "Invalid input" ? "Please check the highlighted fields." : r.data.error ?? "Could not save."); }
  }
  async function remove(id: string) { setBusy(true); const r = await call(`/api/account/addresses/${id}`, "DELETE"); setBusy(false); setConfirmId(null); setMsg(r.ok ? "Address deleted." : "Could not delete."); router.refresh(); }
  async function makeDefault(id: string) { setBusy(true); await call(`/api/account/addresses/${id}/default`, "POST"); setBusy(false); setMsg("Default address updated."); router.refresh(); }

  const a = editing && editing !== "new" ? editing : null;
  return (
    <div className="mt-6">
      {msg && <p role="status" className="mb-4 text-sm font-medium text-success">{msg}</p>}
      {editing ? (
        <form onSubmit={save} className="card max-w-2xl space-y-4 p-6" noValidate aria-label={editing === "new" ? "Add address" : "Edit address"}>
          <h2 className="text-lg">{editing === "new" ? "Add a new address" : "Edit address"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Full name" name="fullName" required defaultValue={a?.fullName ?? defaultName} error={fe.fullName?.[0]} />
            <TextInput label="Mobile number" name="phone" required inputMode="tel" placeholder="01XXXXXXXXX" defaultValue={a?.phone ?? defaultPhone} error={fe.phone?.[0]} />
          </div>
          <TextInput label="Address" name="line1" required placeholder="House, road, block" defaultValue={a?.line1} error={fe.line1?.[0]} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Area" name="area" required defaultValue={a?.area} error={fe.area?.[0]} />
            <TextInput label="City" name="city" required defaultValue={a?.city ?? "Dhaka"} error={fe.city?.[0]} />
            <TextInput label="Postal code" name="postalCode" inputMode="numeric" maxLength={4} defaultValue={a?.postalCode} error={fe.postalCode?.[0]} />
          </div>
          <TextArea label="Delivery instructions (optional)" name="instructions" rows={2} defaultValue={a?.instructions} error={fe.instructions?.[0]} />
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" name="isDefault" defaultChecked={a?.isDefault} className="h-5 w-5 accent-brand" />Make this my default address</label>
          <div className="flex gap-3"><Button disabled={busy}>{busy ? "Saving…" : "Save address"}</Button><Button type="button" variant="ghost" onClick={() => { setEditing(null); setFe({}); }}>Cancel</Button></div>
        </form>
      ) : (
        <Button onClick={() => { setEditing("new"); setMsg(""); }} disabled={initial.length >= 10}><Plus size={16} aria-hidden /> Add address</Button>
      )}

      {initial.length === 0 && !editing ? (
        <div className="mt-6 rounded-xl border border-dashed border-ink-soft/40 bg-white p-10 text-center"><p className="font-bold text-deep">No saved addresses</p><p className="mt-1 text-sm text-ink-soft">Add an address to check out faster.</p></div>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {initial.map((x) => (
            <li key={x.id} className="card flex flex-col p-5">
              <div className="flex items-start justify-between gap-2"><span className="flex items-center gap-2 font-semibold text-deep"><MapPin size={16} className="text-leaf" aria-hidden />{x.fullName}</span>{x.isDefault && <span className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold text-deep">Default</span>}</div>
              <p className="mt-2 flex-1 text-sm">{x.line1}<br />{x.area}, {x.city}{x.postalCode && ` ${x.postalCode}`}<br />{x.phone}{x.instructions && <span className="mt-1 block text-ink-soft">Note: {x.instructions}</span>}</p>
              {confirmId === x.id ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">Delete this address?</span><Button variant="outline" disabled={busy} onClick={() => remove(x.id)}>Yes, delete</Button><Button variant="ghost" onClick={() => setConfirmId(null)}>Keep</Button></div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => { setEditing(x); setMsg(""); }} aria-label={`Edit address for ${x.fullName}`}><Pencil size={15} aria-hidden /> Edit</Button>
                  {!x.isDefault && <Button variant="ghost" disabled={busy} onClick={() => makeDefault(x.id)}>Set as default</Button>}
                  <Button variant="ghost" onClick={() => setConfirmId(x.id)} aria-label={`Delete address for ${x.fullName}`}><Trash2 size={15} aria-hidden /> Delete</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
