import type { Category, Order, OrderInput, Product } from "../domain/types";

/** Contract the UI depends on. Swap the implementation to integrate the ERP. */
export interface CatalogRepository {
  listCategories(): Promise<Category[]>;
  listProducts(): Promise<Product[]>;
  getProductBySlug(slug: string): Promise<Product | null>;
}
export interface OrderRepository {
  createOrder(input: OrderInput): Promise<Order>;
  getOrderByReference(reference: string, phone: string): Promise<Order | null>;
  listOrdersForPhone(phone: string): Promise<Order[]>;
}
