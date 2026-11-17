import { z } from "zod";
import { normalizeBdPhone } from "../identity.ts";

// Server-side validation for every account input. Shared by the API routes and tests.
const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const password = z.string().max(128);
const fullName = z.string().trim().min(2, "Enter your full name").max(100);

/** Optional BD mobile: blank is allowed; anything entered must be a valid Bangladesh mobile (stored as E.164). */
const optionalPhone = z.string().trim().max(30).transform((v, ctx) => {
  if (v === "") return "";
  const n = normalizeBdPhone(v);
  if (!n) { ctx.addIssue({ code: "custom", message: "Enter a valid Bangladesh mobile number" }); return z.NEVER; }
  return n;
});
const requiredPhone = z.string().trim().min(1, "Enter a mobile number").transform((v, ctx) => {
  const n = normalizeBdPhone(v);
  if (!n) { ctx.addIssue({ code: "custom", message: "Enter a valid Bangladesh mobile number" }); return z.NEVER; }
  return n;
});

export const registerSchema = z.object({ fullName, email, password, phone: optionalPhone.optional().default("") });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password });
export const profileSchema = z.object({ fullName, phone: optionalPhone });
export const addressSchema = z.object({
  fullName, phone: requiredPhone,
  line1: z.string().trim().min(5, "Enter the street address").max(200),
  area: z.string().trim().min(2, "Enter the area").max(100),
  city: z.string().trim().min(2, "Enter the city").max(100),
  postalCode: z.string().trim().regex(/^(\d{4})?$/, "Postal code is 4 digits").default(""),
  instructions: z.string().trim().max(300).default(""),
  isDefault: z.boolean().optional().default(false),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
