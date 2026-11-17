"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getLocalOrders, type LocalOrder } from "@/lib/localOrders";
import { OrderStatusView, type TrackedOrder } from "@/components/OrderStatusView";

interface Profile { name: string; phone: string; email: string }
const KEY = "mart-profile";

// DEMO ACCOUNT: the profile lives only in this browser's localStorage. Real registration/login
// (Supabase Auth, phone OTP) is blocked on the auth decision noted in the integration audit.
export default function AccountPage() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [local, setLocal] = useState<LocalOrder[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    try { setProfile(JSON.parse(localStorage.getItem(KEY) ?? "null")); } catch { /* ignore */ }
    const l = getLocalOrders(); setLocal(l); setReady(true);
    Promise.all(l.map((o) => fetch(`/api/orders/${o.reference}?phone=${encodeURIComponent(o.phone)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)))
      .then((res) => setOrders(res.filter(Boolean)));
  }, []);

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    if (mode === "login") {
      const saved: Profile | null = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { return null; } })();
      if (!saved || saved.phone !== String(f.get("phone"))) { setMsg("No account found on this device for that number. Register instead."); return; }
      setProfile(saved); setMsg(""); return;
    }
    const p = { name: String(f.get("name")), phone: String(f.get("phone")), email: String(f.get("email") ?? "") };
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
    setProfile(p); setMsg("");
  }

  if (!ready) return <div className="container-page py-16 text-sm text-charcoal/60" role="status">Loading…</div>;

  if (!profile)
    return (
      <div className="container-page max-w-md py-12">
        <h1 className="text-4xl">{mode === "register" ? "Create account" : "Log in"}</h1>
        <p className="mt-2 text-sm text-charcoal/65">Demo account stored on this device only. <Link href="/track" className="underline">Track an order without an account</Link>.</p>
        <form onSubmit={save} className="mt-8 space-y-4">
          {mode === "register" && <div><label className="label" htmlFor="n">Full name</label><input id="n" name="name" required className="input" autoComplete="name" /></div>}
          <div><label className="label" htmlFor="p">Mobile number</label><input id="p" name="phone" required inputMode="tel" className="input" autoComplete="tel" placeholder="01XXXXXXXXX" /></div>
          {mode === "register" && <div><label className="label" htmlFor="e">Email (optional)</label><input id="e" name="email" type="email" className="input" autoComplete="email" /></div>}
          {msg && <p role="alert" className="text-sm text-clay">{msg}</p>}
          <button className="btn-primary w-full">{mode === "register" ? "Create account" : "Log in"}</button>
        </form>
        <button onClick={() => { setMode(mode === "register" ? "login" : "register"); setMsg(""); }} className="mt-4 text-sm text-forest underline">
          {mode === "register" ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </div>
    );

  return (
    <div className="container-page max-w-3xl py-12">
      <div className="flex items-start justify-between gap-4">
        <div><h1 className="text-4xl">Hello, {profile.name.split(" ")[0]}</h1><p className="mt-1 text-sm text-charcoal/65">{profile.phone}{profile.email && ` · ${profile.email}`}</p></div>
        <button onClick={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setProfile(null); }} className="btn-outline">Log out</button>
      </div>
      <h2 className="mb-4 mt-10 text-2xl">Order history</h2>
      {orders.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-white p-10 text-center">
          <p className="font-serif text-xl">{local.length ? "Loading your orders…" : "No orders yet"}</p>
          <p className="mt-2 text-sm text-charcoal/65">Orders you place on this device will appear here with live status.</p>
          <Link href="/shop" className="btn-primary mt-5">Start shopping</Link>
        </div>
      ) : <div className="space-y-6">{orders.map((o) => <OrderStatusView key={o.reference} order={o} />)}</div>}
    </div>
  );
}
