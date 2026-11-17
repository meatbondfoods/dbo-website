import { notFound } from "next/navigation";

// Defence in depth: the middleware already 404s /admin in production. If it were ever bypassed,
// this layout refuses to render too. Remove only when real authentication guards this route.
export const dynamic = "force-dynamic";
export const metadata = { title: "Admin (development preview)", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-screen bg-canvas">
      <div className="bg-gold px-4 py-2 text-center text-sm font-semibold text-deep">
        Development preview only. This area has no authentication and is disabled on every deployed site.
      </div>
      {children}
    </div>
  );
}
