import type { Category, Order, OrderInput, Product } from "../domain/types";

/** Contract the UI depends on. Swap the implementation to integrate the ERP. */
export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listProducts(): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
}
export interface OrderRepository {
  /** Must be idempotent: the same key returns the original order, never a second one. */
  createOrder(input: OrderInput, idempotencyKey: string, customerId?: string): Promise<Order>;
  getOrderByReference(reference: string, phone: string): Promise<Order | null>;
  listOrdersForPhone(phone: string): Promise<Order[]>;
  /** Orders placed by one signed-in customer (never another customer's). */
  listForCustomer(customerId: string): Promise<Order[]>;
  /** Admin/inbox view of every website order. In production this is the ERP order inbox. */
  listAll(): Promise<Order[]>;
}
