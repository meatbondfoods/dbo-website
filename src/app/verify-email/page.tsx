import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyEmail } from "@/components/auth/forms";

export const metadata = { title: "Verify email" };
export const dynamic = "force-dynamic";

export default function VerifyPage() {
  return <AuthShell title="Email verification"><Suspense><VerifyEmail /></Suspense></AuthShell>;
}
