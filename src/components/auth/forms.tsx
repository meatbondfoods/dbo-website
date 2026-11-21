"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TextInput } from "@/components/ui/FormControls";
import { Button } from "@/components/ui/Button";

type Res = { ok: boolean; status: number; data: Record<string, any> };
async function post(url: string, body: unknown): Promise<Res> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, data: { error: "Network problem. Please try again." } }; }
}
const fieldErr = (d: Record<string, any>) => (d.details?.fieldErrors ?? {}) as Record<string, string[]>;
const safeNext = (n: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/account");

function Notice({ kind, children }: { kind: "error" | "ok"; children: React.ReactNode }) {
  return <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm font-medium ${kind === "error" ? "border-danger/30 bg-danger/5 text-danger" : "border-success/30 bg-mint-light text-deep"}`}>{children}</p>;
}
/** Development mode sends no email, so the one-time link is shown here instead. Never present in production. */
function DevLink({ href }: { href?: string }) {
  if (!href) return null;
  return <p className="rounded-lg border-2 border-dashed border-gold bg-white p-3 text-sm">Development mode: no email is sent. <Link href={href} className="font-semibold text-brand underline">Open the link from the email</Link></p>;
}
function PasswordField({ label, name, error, hint, autoComplete }: { label: string; name: string; error?: string; hint?: string; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <TextInput label={label} name={name} type={show ? "text" : "password"} required autoComplete={autoComplete} error={error} hint={hint} />
      <label className="mt-2 flex min-h-[32px] cursor-pointer items-center gap-2 text-xs text-ink-soft"><input type="checkbox" className="h-4 w-4 accent-brand" checked={show} onChange={(e) => setShow(e.target.checked)} />Show password</label>
    </div>
  );
}

function SocialDivider() {
  return (
    <div className="relative my-2">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-hairline" /></div>
      <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-ink-soft">Or continue with</span></div>
    </div>
  );
}

export function GoogleLoginButton({ next }: { next?: string | null }) {
  const href = `/api/auth/oauth?provider=google${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  return (
    <a
      href={href}
      className="btn-outline flex w-full items-center justify-center gap-2.5 text-sm font-semibold hover:border-ink/30 hover:bg-neutral-50"
      aria-label="Continue with Google"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        />
      </svg>
      Continue with Google
    </a>
  );
}

export function FacebookLoginButton({ next }: { next?: string | null }) {
  const href = `/api/auth/oauth?provider=facebook${next ? `&next=${encodeURIComponent(next)}` : ""}`;
  return (
    <a
      href={href}
      className="btn-outline flex w-full items-center justify-center gap-2.5 text-sm font-semibold hover:border-[#1877F2]/50 hover:bg-[#1877F2]/5"
      aria-label="Continue with Facebook"
    >
      <svg className="h-5 w-5 fill-[#1877F2]" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
      Continue with Facebook
    </a>
  );
}

const form = (e: React.FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

export function LoginForm() {
  const router = useRouter(); const sp = useSearchParams();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [unverified, setUnverified] = useState(""); const [dev, setDev] = useState<string>();
  const verified = sp.get("verified"), reset = sp.get("reset"), linkErr = sp.get("error");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const v = form(e); setBusy(true); setErr(""); setUnverified("");
    const r = await post("/api/auth/login", { email: v.email, password: v.password });
    if (r.ok) { router.push(safeNext(sp.get("next"))); router.refresh(); return; }
    setErr(r.data.error ?? "Could not sign in."); if (r.data.code === "unverified") setUnverified(v.email); setBusy(false);
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {verified && <Notice kind="ok">Email verified. You can sign in now.</Notice>}
      {reset && <Notice kind="ok">Password updated. Please sign in with your new password.</Notice>}
      {linkErr && (
        <Notice kind="error">
          {linkErr === "oauth_init_failed"
            ? "Could not connect to social login provider. Please verify the provider is enabled in Supabase."
            : linkErr === "auth_off"
            ? "Social login is not available yet."
            : "That link is invalid or has expired."}
        </Notice>
      )}
      <TextInput label="Email" name="email" type="email" required autoComplete="email" />
      <PasswordField label="Password" name="password" autoComplete="current-password" />
      {err && <Notice kind="error">{err}</Notice>}
      {unverified && <Button type="button" variant="outline" onClick={async () => { const r = await post("/api/auth/resend", { email: unverified }); setDev(r.data.devLink); setErr(r.data.message ?? ""); }}>Resend verification email</Button>}
      <DevLink href={dev} />
      <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
      <SocialDivider />
      <div className="space-y-2.5">
        <GoogleLoginButton next={sp.get("next")} />
        <FacebookLoginButton next={sp.get("next")} />
      </div>
      <p className="text-center text-sm"><Link href="/forgot-password" className="font-semibold text-brand underline">Forgot your password?</Link></p>
    </form>
  );
}

export function RegisterForm() {
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [fe, setFe] = useState<Record<string, string[]>>({});
  const [done, setDone] = useState<{ message: string; devLink?: string } | null>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const v = form(e); setBusy(true); setErr(""); setFe({});
    if (v.password !== v.confirm) { setFe({ confirm: ["Passwords do not match"] }); setBusy(false); return; }
    const r = await post("/api/auth/register", { fullName: v.fullName, email: v.email, password: v.password, phone: v.phone });
    setBusy(false);
    if (r.ok) { setDone({ message: r.data.message, devLink: r.data.devLink }); return; }
    setFe(fieldErr(r.data)); setErr(r.status === 422 && r.data.details ? "Please check the highlighted fields." : r.data.error ?? "Could not create your account.");
  }
  if (done) return <div className="space-y-4"><Notice kind="ok">{done.message} You must verify your email before you can sign in.</Notice><DevLink href={done.devLink} /><Link href="/login" className="btn-outline">Go to sign in</Link></div>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextInput label="Full name" name="fullName" required autoComplete="name" error={fe.fullName?.[0]} />
      <TextInput label="Email" name="email" type="email" required autoComplete="email" error={fe.email?.[0]} />
      <TextInput label="Mobile number (optional)" name="phone" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" error={fe.phone?.[0]} hint="Used for delivery contact. It is not used to sign in." />
      <PasswordField label="Password" name="password" autoComplete="new-password" hint="At least 10 characters, with letters and numbers." error={fe.password?.[0]} />
      <TextInput label="Confirm password" name="confirm" type="password" required autoComplete="new-password" error={fe.confirm?.[0]} />
      {err && <Notice kind="error">{err}</Notice>}
      <Button className="w-full" disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
      <SocialDivider />
      <div className="space-y-2.5">
        <GoogleLoginButton next={sp.get("next")} />
        <FacebookLoginButton next={sp.get("next")} />
      </div>
      <p className="text-center text-xs text-ink-soft">By registering you agree to our <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy-policy" className="underline">privacy policy</Link>.</p>
    </form>
  );
}

export function ForgotForm() {
  const [busy, setBusy] = useState(false); const [done, setDone] = useState<{ message: string; devLink?: string } | null>(null); const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; setBusy(true); setErr("");
    const r = await post("/api/auth/forgot", { email: form(e).email }); setBusy(false);
    r.ok ? setDone({ message: r.data.message, devLink: r.data.devLink }) : setErr(r.data.error ?? "Please enter a valid email address.");
  }
  if (done) return <div className="space-y-4"><Notice kind="ok">{done.message}</Notice><DevLink href={done.devLink} /></div>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextInput label="Email" name="email" type="email" required autoComplete="email" />
      {err && <Notice kind="error">{err}</Notice>}
      <Button className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
    </form>
  );
}

export function ResetForm() {
  const router = useRouter(); const sp = useSearchParams(); const token = sp.get("token") ?? "";
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [fe, setFe] = useState<Record<string, string[]>>({});
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const v = form(e); setErr(""); setFe({});
    if (v.password !== v.confirm) { setFe({ confirm: ["Passwords do not match"] }); return; }
    setBusy(true); const r = await post("/api/auth/reset", { token, password: v.password }); setBusy(false);
    if (r.ok) { router.push("/login?reset=1"); return; }
    setErr(r.data.error ?? "Could not reset your password.");
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <PasswordField label="New password" name="password" autoComplete="new-password" hint="At least 10 characters, with letters and numbers." />
      <TextInput label="Confirm new password" name="confirm" type="password" required autoComplete="new-password" error={fe.confirm?.[0]} />
      {err && <Notice kind="error">{err}</Notice>}
      <Button className="w-full" disabled={busy}>{busy ? "Saving…" : "Set new password"}</Button>
    </form>
  );
}

export function VerifyEmail() {
  const sp = useSearchParams(); const token = sp.get("token");
  const [state, setState] = useState<"working" | "ok" | "error">("working"); const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!token) { setState("error"); setMsg("This verification link is incomplete."); return; }
    post("/api/auth/verify", { token }).then((r) => { setState(r.ok ? "ok" : "error"); setMsg(r.data.error ?? ""); });
  }, [token]);
  if (state === "working") return <p role="status" className="text-sm text-ink-soft">Verifying your email…</p>;
  return state === "ok"
    ? <div className="space-y-4"><Notice kind="ok">Your email is verified.</Notice><Link href="/login?verified=1" className="btn-primary">Sign in</Link></div>
    : <div className="space-y-4"><Notice kind="error">{msg || "This verification link is invalid or has expired."}</Notice><Link href="/login" className="btn-outline">Back to sign in</Link></div>;
}

export function LogoutButton({ variant = "outline", className = "" }: { variant?: "outline" | "ghost"; className?: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  return <Button variant={variant} className={className} disabled={busy} onClick={async () => { setBusy(true); await post("/api/auth/logout", {}); router.push("/"); router.refresh(); }}>Sign out</Button>;
}
