import { createClient } from "@supabase/supabase-js";
import type { Category, Product } from "../domain/types.ts";
import type { CatalogRepository } from "./types.ts";
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "../demo/data.ts";

interface SyncedStore {
  products: Map<string, Product>;
  categories: Map<string, Category>;
}

const g = globalThis as unknown as { __martSyncedCatalog?: SyncedStore };
const store: SyncedStore = (g.__martSyncedCatalog ??= {
  products: new Map<string, Product>(),
  categories: new Map<string, Category>(DEMO_CATEGORIES.map((c) => [c.id, c])),
});

export class SupabaseCatalogRepository implements CatalogRepository {
  private client: ReturnType<typeof createClient> | null = null;

  constructor() {
    const isTest = process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test";
    const url = !isTest
      ? (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "")
      : (process.env.TEST_LIVE_DB === "true" ? process.env.NEXT_PUBLIC_SUPABASE_URL || "" : "");
    const key = !isTest
      ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "")
      : (process.env.TEST_LIVE_DB === "true" ? process.env.SUPABASE_SERVICE_ROLE_KEY || "" : "");

    if (url && key) {
      try {
        this.client = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
      } catch (err) {
        console.warn("[SupabaseCatalogRepository] Supabase client init error:", err);
      }
    }
  }

  /**
   * Returns whether live ERP catalog projection is active and populated.
   */
  isErpCatalogActive(): boolean {
    const flag = (process.env.MART_CATALOG_SOURCE || "erp").toLowerCase();
    return flag === "erp";
  }

  async listCategories(): Promise<Category[]> {
    if (this.client) {
      try {
        const { data, error } = await (this.client as any)
          .from("web_catalog_categories")
          .select("*")
          .order("sort_order", { ascending: true });

        if (data && !error && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            slug: d.slug,
            name: d.name,
            description: d.description || "",
          }));
        }
      } catch (err) {
        console.warn("[SupabaseCatalogRepository] Error reading categories:", err);
      }
    }

    // Memory synced store
    if (store.categories.size > 0) {
      return Array.from(store.categories.values());
    }

    return DEMO_CATEGORIES;
  }

  async listProducts(): Promise<Product[]> {
    // 1. Query database projection if connected
    if (this.client) {
      try {
        const { data, error } = await (this.client as any)
          .from("web_catalog_products")
          .select("*")
          .order("sort_order", { ascending: true });

        if (data && !error && data.length > 0) {
          return data
            .map((d: any) => this.mapDbRowToProduct(d))
            .filter((p: Product) => p.isPublished !== false);
        }
      } catch (err) {
        console.warn("[SupabaseCatalogRepository] Error reading products from Supabase:", err);
      }
    }

    // 2. Query in-memory synchronized projection (populated via sync webhook)
    if (store.products.size > 0) {
      return Array.from(store.products.values()).filter((p) => p.isPublished !== false);
    }

    // 3. Fallback rules:
    // In production, NEVER silently fall back to demo pricing if ERP catalog mode is required.
    const isProd = process.env.NODE_ENV === "production";
    const forceErp = (process.env.MART_CATALOG_SOURCE || "").toLowerCase() === "erp";

    if (isProd && forceErp) {
      // In production, when ERP mode is enforced, return empty array to prevent checkout on fake demo rates
      return [];
    }

    // Dev/testing fallback
    return DEMO_PRODUCTS;
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const products = await this.listProducts();
    const found = products.find((p) => p.slug === slug);
    return found ?? null;
  }

  private mapDbRowToProduct(row: any): Product {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryId: row.category_id,
      description: row.description || "",
      storageInstructions: row.storage_instructions || "",
      images: Array.isArray(row.images) ? row.images : typeof row.images === "string" ? JSON.parse(row.images) : [],
      options: Array.isArray(row.options) ? row.options : typeof row.options === "string" ? JSON.parse(row.options) : [],
      availability: row.availability || "in_stock",
      tags: Array.isArray(row.tags) ? row.tags : [],
      rating: Number(row.rating) || 5.0,
      reviewCount: Number(row.review_count) || 0,
      badge: row.badge || undefined,
      compareAtPrice: row.compare_at_price ? Number(row.compare_at_price) : undefined,
      isPublished: row.is_published !== undefined ? Boolean(row.is_published) : true,
    };
  }
}

// ── In-Memory Synchronization Helpers (For Webhook & Testing) ──────────

export function upsertSyncedProduct(product: Product) {
  store.products.set(product.id, product);
}

export function removeSyncedProduct(id: string) {
  store.products.delete(id);
}

export function bulkSetSyncedProducts(products: Product[], categories?: Category[]) {
  store.products.clear();
  for (const p of products) {
    store.products.set(p.id, p);
  }
  if (categories && categories.length > 0) {
    store.categories.clear();
    for (const c of categories) {
      store.categories.set(c.id, c);
    }
  }
}

export function getSyncedCatalogCount(): { products: number; categories: number } {
  return { products: store.products.size, categories: store.categories.size };
}

export function clearSyncedCatalog() {
  store.products.clear();
  store.categories.clear();
  for (const c of DEMO_CATEGORIES) {
    store.categories.set(c.id, c);
  }
}
