import { z } from "zod";

// Pure module (no server-only, no path aliases): imported by the server store, the admin editors and tests.
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #124C32");
// A local link is "/" or "/something" and may NOT start with "//" (that would be a protocol-relative, off-site link).
const link = z.string().trim().regex(/^(\/(?!\/)[A-Za-z0-9/_\-?=&#.]*|https:\/\/[^\s]+)$/, "Use a path like /shop or a full https:// link");
const optLink = z.union([z.literal(""), link]);
const optHttps = z.union([z.literal(""), z.string().trim().regex(/^https:\/\/[^\s]+$/, "Use a full https:// link")]);
// An image is either a path inside this site (/uploads/x.png) or an https:// URL (Supabase Storage in production). Blank = none.
const media = z.union([
  z.literal(""),
  z.string().trim().regex(/^\/[A-Za-z0-9/_.-]+$/, "Use an uploaded image or a path like /products/hero.svg").refine((s) => !s.includes(".."), "Invalid path"),
  z.string().trim().regex(/^https:\/\/[^\s]+$/, "Use a full https:// link"),
]);
const imagePath = media.refine((v) => v !== "", "Choose an image");
export const SECTION_IDS = ["categories", "featured", "why", "quality", "best", "banner", "reviews", "newsletter"] as const;

export const heroSchema = z.object({
  eyebrow: z.string().trim().max(40),
  headline: z.string().trim().min(5).max(90),
  subheadline: z.string().trim().max(240),
  primaryLabel: z.string().trim().min(2).max(24), primaryHref: link,
  secondaryLabel: z.string().trim().max(24), secondaryHref: optLink,
  imagePath, imageAlt: z.string().trim().min(3).max(140),
  trustItems: z.array(z.string().trim().min(2).max(40)).max(4),
});

export const themeSchema = z.object({
  brand: hex, deep: hex, leaf: hex, mint: hex, gold: hex, canvas: hex, ink: hex,
  buttonRadius: z.enum(["md", "lg", "full"]),
  headingWeight: z.enum(["600", "700", "800"]),
});

export const siteSchema = z.object({
  announcement: z.string().trim().max(140),
  phone: z.string().trim().max(30),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]),
  address: z.string().trim().max(200),
  facebook: optHttps, instagram: optHttps, youtube: optHttps,
  footerBlurb: z.string().trim().max(240),
});

export const commerceSchema = z.object({
  active: z.boolean(),                                    // delivery policy is applied only when an owner activates it
  freeRadiusKm: z.number().min(0).max(100),
  chargeBeyond: z.number().min(0).max(2000),
  freeOverAmount: z.number().min(0).max(1_000_000),      // 0 = no free-over-amount rule
  areas: z.array(z.object({ name: z.string().trim().min(2).max(60), distanceKm: z.number().min(0).max(200) })).max(80),
});

export const productDisplaySchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1).max(64),
    visible: z.boolean(), featured: z.boolean(), bestSeller: z.boolean(),
    promoLabel: z.string().trim().max(24), sortOrder: z.number().int().min(0).max(9999),
  })).max(2000),
});

export const bannersSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(40), title: z.string().trim().min(2).max(80), text: z.string().trim().max(240),
    ctaLabel: z.string().trim().max(24), ctaHref: optLink, imagePath: media, active: z.boolean(),
  })).max(5),
});
export const navigationSchema = z.object({
  showCategories: z.boolean(),
  items: z.array(z.object({ label: z.string().trim().min(1).max(24), href: link })).max(8),
});
export const sectionsSchema = z.object({
  items: z.array(z.object({ id: z.enum(SECTION_IDS), visible: z.boolean(), title: z.string().trim().max(60) })).max(12),
});
export const seoSchema = z.object({ siteTitle: z.string().trim().min(2).max(70), description: z.string().trim().max(200), ogImage: media });
export const brandSchema = z.object({ logoPath: media, logoAlt: z.string().trim().max(100) });

export const SCHEMAS = {
  hero: heroSchema, theme: themeSchema, site: siteSchema, commerce: commerceSchema, productDisplay: productDisplaySchema,
  banners: bannersSchema, navigation: navigationSchema, sections: sectionsSchema, seo: seoSchema, brand: brandSchema,
} as const;
export type ContentKey = keyof typeof SCHEMAS;
export type ContentMap = { [K in ContentKey]: z.infer<(typeof SCHEMAS)[K]> };
export const CONTENT_KEYS = Object.keys(SCHEMAS) as ContentKey[];
export const isContentKey = (k: string): k is ContentKey => k in SCHEMAS;

export type DeliveryConfig = ContentMap["commerce"];
