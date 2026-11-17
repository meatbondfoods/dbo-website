import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterForm } from "@/components/auth/forms";
import { currentCustomer } from "@/lib/auth/service";

export const metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentCustomer()) redirect("/account");
  return (
    <AuthShell title="Create your account" intro="Save addresses, check out faster and track your orders." footer={<>Already have an account? <Link href="/login" className="font-semibold text-brand underline">Sign in</Link></>}>
      <RegisterForm />
    </AuthShell>
  );
}
