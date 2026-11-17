import { z } from "zod";

// Pure module (no server-only, no path aliases): imported by the server store, the admin editors and tests.
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #124C32");
const link = z.string().trim().regex(/^(\/[A-Za-z0-9/_\-?=&#.]*|https:\/\/[^\s]+)$/, "Use a path like /shop or a full https:// link");
const optLink = z.union([z.literal(""), link]);
const optHttps = z.union([z.literal(""), z.string().trim().regex(/^https:\/\/[^\s]+$/, "Use a full https:// link")]);
const imagePath = z.string().trim().regex(/^\/[A-Za-z0-9/_.-]+$/, "Use a file path from the public folder, like /products/hero.svg").refine((s) => !s.includes(".."), "Invalid path");

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

export const SCHEMAS = { hero: heroSchema, theme: themeSchema, site: siteSchema, commerce: commerceSchema, productDisplay: productDisplaySchema } as const;
export type ContentKey = keyof typeof SCHEMAS;
export type ContentMap = { [K in ContentKey]: z.infer<(typeof SCHEMAS)[K]> };
export const CONTENT_KEYS = Object.keys(SCHEMAS) as ContentKey[];
export const isContentKey = (k: string): k is ContentKey => k in SCHEMAS;

export type DeliveryConfig = ContentMap["commerce"];
