import { requireAdminPage } from "@/lib/adminAuth";
import { AdminNav } from "./_components/AdminNav";

export const dynamic = "force-dynamic";

// Every page in this group requires a signed-in website admin (role checked server-side on each request).
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage("viewer");
  return (
    <div className="lg:flex">
      <AdminNav email={admin.email} role={admin.role} />
      <div className="min-w-0 flex-1 px-4 pb-16 sm:px-6">{children}</div>
    </div>
  );
}
