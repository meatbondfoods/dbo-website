import "server-only";
import { DemoCatalogRepository, DemoOrderRepository } from "./demo";
import { SupabaseCatalogRepository } from "./supabase-catalog";
import { SupabaseOrderRepository } from "./supabase";
import type { CatalogRepository, OrderRepository } from "./types";

// Single switch point. When MART_DATA_SOURCE="erp", use SupabaseOrderRepository
const demoCatalog = new DemoCatalogRepository();
const supabaseCatalog = new SupabaseCatalogRepository();
const demoOrders = new DemoOrderRepository();
const supabaseOrders = new SupabaseOrderRepository(undefined, supabaseCatalog);

export function getRepositories(): { catalog: CatalogRepository; orders: OrderRepository; source: "demo" | "erp" } {
  const isCatalogErp = (process.env.MART_CATALOG_SOURCE || "erp").toLowerCase() === "erp";
  const catalog = isCatalogErp ? supabaseCatalog : demoCatalog;
  // Always use SupabaseOrderRepository for persistent order checkout and ERP dispatch
  return { catalog, orders: supabaseOrders, source: "erp" };
}
