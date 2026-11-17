import { redirect } from "next/navigation";
import { currentAdmin, ensureDevAdmin } from "@/lib/adminAuth";
import { AdminLoginForm } from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  await ensureDevAdmin();
  if (await currentAdmin()) redirect("/admin");
  return (
    <div className="container-page max-w-md py-16">
      <h1 className="text-3xl">Admin sign-in</h1>
      <p className="mt-2 text-sm text-ink-soft">Website administrators only. Development credentials are generated on first run and saved to <code className="rounded bg-mint-light px-1.5 py-0.5">.data/dev-admin.json</code>.</p>
      <div className="card mt-6 p-6"><AdminLoginForm /></div>
    </div>
  );
}
