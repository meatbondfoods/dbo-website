// Single source of truth for "may the admin area exist at all on this server?". Pure (no imports) so the edge
// middleware, server code and tests all use the same rule.
//
//  - Development (next dev): always allowed (demo admin, file store).
//  - Production: allowed ONLY when ALL of these are explicitly configured:
//        MART_ADMIN=enabled        (a deliberate switch, set only after the owner approves going live)
//        MART_AUTH=supabase        (real authentication, never the demo provider)
//        NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
//    Anything else, including a missing variable, means the admin area answers 404.
export function adminAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.MART_ADMIN === "enabled" && process.env.MART_AUTH === "supabase"
    && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
