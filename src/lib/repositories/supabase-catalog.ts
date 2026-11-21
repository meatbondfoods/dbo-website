import { createClient } from "@supabase/supabase-js";
import type { Category, Product } from "../domain/types.ts";
import type { CatalogRepository } from "./types.ts";
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "../demo/data.ts";

/**
 * Storefront catalogue read from the database projection that the ERP keeps current
 * (web_catalog_products / web_catalog_categories, written only by apply_catalog_event).
 * Reads use the public anon key and row-level security: only published products are visible.
 * Nothing is cached in memory, so every server instance shows the same catalogue.
 */
interface ReadClient {
  from(table: string): any;
}

export class SupabaseCatalogRepository implements CatalogRepository {
  private client: ReadClient | null = null;

  constructor(client?: ReadClient) {
    if (client) {
      this.client = client;
      return;
    }
    const isTest = process.env.NODE_ENV === "test" || process.env.npm_lifecycle_event === "test";
    const url = isTest ? "" : process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const key = isTest ? "" : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    if (url && key) {
      try {
        this.client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) as unknown as ReadClient;
      } catch (err) {
        console.warn("[SupabaseCatalogRepository] Supabase client init error:", err);
      }
    }
  }

  isErpCatalogActive(): boolean {
    return (process.env.MART_CATALOG_SOURCE || "erp").toLowerCase() === "erp";
  }

  /** Demo data is a development convenience only: production never shows invented prices. */
  private fallbackAllowed(): boolean {
    return process.env.NODE_ENV !== "production";
  }

  async listCategories(): Promise<Category[]> {
    if (this.client) {
      const { data, error } = await this.client.from("web_catalog_categories").select("*").order("sort_order", { ascending: true });
      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({ id: d.id, slug: d.slug, name: d.name, description: d.description || "" }));
      }
      if (error) console.warn("[SupabaseCatalogRepository] Error reading categories:", error.message);
    }
    return this.fallbackAllowed() ? DEMO_CATEGORIES : [];
  }

  async listProducts(): Promise<Product[]> {
    if (this.client) {
      const { data, error } = await this.client
        .from("web_catalog_products")
        .select("*")
        .eq("is_published", true)
        .order("sort_order", { ascending: true });
      if (error) console.warn("[SupabaseCatalogRepository] Error reading products:", error.message);
      if (!error && data && data.length > 0) return data.map((d: any) => this.mapDbRowToProduct(d));
      // A connected, healthy but empty projection means "nothing is published yet".
      if (!error) return this.fallbackAllowed() && !this.isErpCatalogActive() ? DEMO_PRODUCTS : [];
    }
    return this.fallbackAllowed() ? DEMO_PRODUCTS : [];
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const products = await this.listProducts();
    return products.find((p) => p.slug === slug) ?? null;
  }

  private mapDbRowToProduct(row: any): Product {
    const json = <T,>(v: unknown, fallback: T): T => (Array.isArray(v) ? (v as T) : typeof v === "string" ? (JSON.parse(v) as T) : fallback);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      categoryId: row.category_id,
      description: row.description || "",
      storageInstructions: row.storage_instructions || "",
      images: json<string[]>(row.images, []),
      options: json<Product["options"]>(row.options, []),
      availability: row.availability || "out_of_stock",
      tags: json<string[]>(row.tags, []),
      // The ERP has no review data, so none is invented: zero reviews means the storefront shows no rating.
      rating: 0,
      reviewCount: 0,
      badge: row.badge || undefined,
      isPublished: row.is_published !== false,
    };
  }
}
