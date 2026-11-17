import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "@/components/auth/forms";

export const metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

export default function ResetPage() {
  return <AuthShell title="Set a new password"><Suspense><ResetForm /></Suspense></AuthShell>;
}
