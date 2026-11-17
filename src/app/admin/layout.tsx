import { notFound } from "next/navigation";
import { adminAllowed } from "@/lib/adminGate";

// Defence in depth: the middleware already 404s /admin in production. If it were ever bypassed,
// this layout refuses to render too. Enabling admin in production needs the approved Supabase admin login.
export const dynamic = "force-dynamic";
export const metadata = { title: "Admin (development)", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!adminAllowed()) notFound();
  return (
    <div className="min-h-screen bg-canvas">
      {process.env.NODE_ENV !== "production" && (
        <div className="bg-gold px-4 py-2 text-center text-sm font-semibold text-deep">
          Development mode. On a deployed site this area is disabled unless it has been deliberately enabled with real sign-in.
        </div>
      )}
      {children}
    </div>
  );
}
