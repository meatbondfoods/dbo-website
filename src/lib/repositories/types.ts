import type { Category, Order, OrderInput, Product } from "../domain/types";

/** Contract the UI depends on. Swap the implementation to integrate the ERP. */
export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listProducts(): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
}
export interface OrderRepository {
  /** Must be idempotent: the same key returns the original order, never a second one. */
  createOrder(input: OrderInput, idempotencyKey: string): Promise<Order>;
  getOrderByReference(reference: string, phone: string): Promise<Order | null>;
  listOrdersForPhone(phone: string): Promise<Order[]>;
}
