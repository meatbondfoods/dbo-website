import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "@/components/auth/forms";

export const metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <AuthShell title="Forgot your password?" intro="Enter your email and we will send a link to reset it." footer={<Link href="/login" className="font-semibold text-brand underline">Back to sign in</Link>}>
      <ForgotForm />
    </AuthShell>
  );
}
