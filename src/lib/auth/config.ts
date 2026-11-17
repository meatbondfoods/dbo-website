export type AuthMode = "supabase" | "demo" | "off";

/**
 * Which account provider is active. Decided by explicit configuration, never by guesswork:
 *  - "supabase": only when MART_AUTH=supabase AND the public Supabase URL + anon key are set.
 *                Production activation requires the owner's approval of the Supabase configuration.
 *  - "demo":     local development ONLY. It is impossible in production (NODE_ENV === "production").
 *  - "off":      accounts are unavailable (what the deployed site is today).
 * Presence of Supabase keys alone does NOT switch anything on.
 */
export function authMode(): AuthMode {
  if (process.env.MART_AUTH === "supabase" && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  if (process.env.NODE_ENV !== "production" && process.env.MART_AUTH !== "off") return "demo";
  return "off";
}
