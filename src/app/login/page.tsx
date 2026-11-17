import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/forms";
import { currentCustomer } from "@/lib/auth/service";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentCustomer()) redirect("/account");
  return (
    <AuthShell title="Sign in" intro="Welcome back. Sign in to see your orders and saved addresses." footer={<>New to MeatBond Mart? <Link href="/register" className="font-semibold text-brand underline">Create an account</Link></>}>
      <Suspense><LoginForm /></Suspense>
    </AuthShell>
  );
}
