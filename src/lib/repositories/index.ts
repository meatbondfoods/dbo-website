import "server-only";
import { DemoCatalogRepository, DemoOrderRepository } from "./demo";
import type { CatalogRepository, OrderRepository } from "./types";

// Single switch point. "erp" will return Supabase-backed adapters once the
// migration in docs/erp-integration is approved and applied. Until then: demo.
const catalog = new DemoCatalogRepository();
const orders = new DemoOrderRepository();

export function getRepositories(): { catalog: CatalogRepository; orders: OrderRepository; source: "demo" | "erp" } {
  if (process.env.MART_DATA_SOURCE === "erp") {
    throw new Error("ERP adapter not implemented yet: pending approved database migration.");
  }
  return { catalog, orders, source: "demo" };
}
