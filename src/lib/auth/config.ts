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

/**
 * Sanitizes a URL and corrects known legacy domain typos (e.g. accidental hyphens).
 */
export function sanitizeSiteUrl(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, "");
  // Safety guard against previously misconfigured hyphenated domain
  if (cleaned.includes("meat-bond-foods-mart.vercel.app")) {
    cleaned = cleaned.replace("meat-bond-foods-mart.vercel.app", "meatbond-foods-mart.vercel.app");
  }
  return cleaned;
}

/**
 * Resolves the canonical absolute site URL for auth redirects (OAuth, email confirmations, password resets).
 * Priority:
 * 1. preferredOrigin: Explicit valid origin from incoming HTTP request (x-forwarded-host / host)
 * 2. NEXT_PUBLIC_SITE_URL: Explicit environment variable
 * 3. VERCEL_PROJECT_PRODUCTION_URL: Automatic Vercel production system env (e.g. meatbond-foods-mart.vercel.app)
 * 4. VERCEL_URL: Automatic Vercel deployment system env
 * 5. Fallback: http://localhost:3000
 */
export function resolveSiteUrl(preferredOrigin?: string | null): string {
  if (preferredOrigin && /^https?:\/\//i.test(preferredOrigin)) {
    return sanitizeSiteUrl(preferredOrigin);
  }

  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) {
    const withProto = /^https?:\/\//i.test(envUrl) ? envUrl : `https://${envUrl}`;
    return sanitizeSiteUrl(withProto);
  }

  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProd) {
    return sanitizeSiteUrl(`https://${vercelProd}`);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return sanitizeSiteUrl(`https://${vercelUrl}`);
  }

  return "http://localhost:3000";
}

