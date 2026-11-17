import { z } from "zod";

// Bangladesh mobile: 01XXXXXXXXX, optionally prefixed with +880 / 880.
const phone = z.string().trim().regex(/^(?:\+?880|0)1[3-9]\d{8}$/, "Enter a valid Bangladesh mobile number");

export const orderInputSchema = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone,
    email: z.string().trim().email().max(200).optional().or(z.literal("").transform(() => undefined)),
  }),
  address: z.object({
    line1: z.string().trim().min(5).max(200),
    area: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    notes: z.string().trim().max(300).optional(),
  }),
  paymentMethod: z.enum(["cod", "bkash", "nagad", "card"]),
  lines: z.array(z.object({
    productId: z.string().min(1).max(64),
    optionId: z.string().min(1).max(32),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(40),
});

export const lookupSchema = z.object({ phone });
export const idempotencyKeySchema = z.string().trim().min(16).max(100).regex(/^[A-Za-z0-9_-]+$/);
