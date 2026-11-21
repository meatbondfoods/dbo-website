import "server-only";
import { DemoCatalogRepository, DemoOrderRepository } from "./demo";
import { SupabaseOrderRepository } from "./supabase";
import type { CatalogRepository, OrderRepository } from "./types";

// Single switch point. When MART_DATA_SOURCE="erp", use SupabaseOrderRepository
const demoCatalog = new DemoCatalogRepository();
const demoOrders = new DemoOrderRepository();
const supabaseOrders = new SupabaseOrderRepository();

export function getRepositories(): { catalog: CatalogRepository; orders: OrderRepository; source: "demo" | "erp" } {
  // Always use SupabaseOrderRepository for persistent order checkout and ERP dispatch
  return { catalog: demoCatalog, orders: supabaseOrders, source: "erp" };
}
