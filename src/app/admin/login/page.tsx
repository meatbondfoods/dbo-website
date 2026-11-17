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
      <p className="mt-2 text-sm text-ink-soft">Website administrators only.{process.env.NODE_ENV !== "production" && process.env.MART_AUTH !== "supabase" && <> Development credentials are generated on first run and saved to <code className="rounded bg-mint-light px-1.5 py-0.5">.data/dev-admin.json</code>.</>}{process.env.MART_AUTH === "supabase" && " Sign in with your MeatBond ERP login. ERP super admins are website owners."}</p>
      <div className="card mt-6 p-6"><AdminLoginForm /></div>
    </div>
  );
}
