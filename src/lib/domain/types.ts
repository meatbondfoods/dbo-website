// Storefront domain model. Deliberately independent of ERP table/column names:
// the ERP adapter is responsible for mapping ERP records into these shapes.
// Mirrors the ERP sales_order_status enum so the adapter needs no status translation.
export type OrderStatus = "draft" | "confirmed" | "processing" | "ready" | "dispatched" | "delivered" | "cancelled";
export type PaymentMethod = "cod" | "bkash" | "nagad" | "card";
export type Availability = "in_stock" | "low_stock" | "out_of_stock";

export interface Category { id: string; slug: string; name: string; description: string; }
export interface WeightOption { id: string; label: string; grams: number; price: number; }
export interface Product {
  id: string; slug: string; name: string; categoryId: string; description: string;
  images: string[]; options: WeightOption[]; availability: Availability;
  tags: string[]; rating: number; reviewCount: number; badge?: string; compareAtPrice?: number;
}
export interface CartLine { productId: string; optionId: string; quantity: number; }
export interface Address { line1: string; area: string; city: string; notes?: string; }
export interface OrderInput {
  customer: { name: string; phone: string; email?: string };
  address: Address; paymentMethod: PaymentMethod; lines: CartLine[];
}
export interface Order {
  id: string; reference: string; status: OrderStatus; createdAt: string;
  subtotal: number; deliveryCharge: number; total: number; input: OrderInput; idempotencyKey: string;
}
