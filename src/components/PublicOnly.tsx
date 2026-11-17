"use client";
import { usePathname } from "next/navigation";

/** Hides storefront chrome (header, footer, cart drawer) on /admin, which has its own layout. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return path === "/admin" || path.startsWith("/admin/") ? null : <>{children}</>;
}
