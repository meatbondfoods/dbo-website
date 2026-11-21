import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SupabaseCatalogRepository,
  upsertSyncedProduct,
  removeSyncedProduct,
  clearSyncedCatalog,
  getSyncedCatalogCount,
} from "../src/lib/repositories/supabase-catalog.ts";
import type { Product } from "../src/lib/domain/types.ts";

test("SupabaseCatalogRepository: Synchronized Catalog, Hybrid Variants and Publication Gating", async () => {
  clearSyncedCatalog();
  const repo = new SupabaseCatalogRepository();

  // 1. Initially empty synced store returns demo fallback in dev/test
  const initialProducts = await repo.listProducts();
  assert.ok(initialProducts.length > 0, "Demo fallback returns products in test");

  // 2. Upsert an ERP product with hybrid variants (weight, piece, pack, custom)
  const testProduct: Product = {
    id: "erp-prod-101",
    slug: "prime-black-angus-ribeye",
    name: "Prime Black Angus Ribeye",
    categoryId: "cat-other",
    description: "Premium chilled ribeye steak cut.",
    storageInstructions: "Keep at 0-4°C",
    images: ["/products/ribeye-1.jpg"],
    options: [
      { id: "var-250g", label: "250 g Steak", grams: 250, price: 650, variantType: "weight", sku: "ANGUS-250G" },
      { id: "var-500g", label: "500 g Steak", grams: 500, price: 1250, variantType: "weight", sku: "ANGUS-500G" },
      { id: "var-1pc", label: "1 Whole Tomahawk", grams: 1200, price: 2900, variantType: "piece", sku: "TOMAHAWK-1PC" },
      { id: "var-pack", label: "BBQ 4-Pack", grams: 1000, price: 2400, variantType: "pack", sku: "ANGUS-BBQ-PACK" },
    ],
    availability: "in_stock",
    tags: ["premium", "bestseller"],
    rating: 4.9,
    reviewCount: 42,
    badge: "Prime Reserve",
    isPublished: true,
  };

  upsertSyncedProduct(testProduct);

  const count = getSyncedCatalogCount();
  assert.equal(count.products, 1);

  // 3. Retrieve list and verify hybrid variants are preserved
  const liveList = await repo.listProducts();
  assert.equal(liveList.length, 1);
  const synced = liveList[0];
  assert.equal(synced.id, "erp-prod-101");
  assert.equal(synced.name, "Prime Black Angus Ribeye");
  assert.equal(synced.options.length, 4);

  // Verify non-linear, product-specific variant pricing
  const opt250 = synced.options.find((o) => o.id === "var-250g");
  const opt500 = synced.options.find((o) => o.id === "var-500g");
  const optPack = synced.options.find((o) => o.id === "var-pack");
  assert.equal(opt250?.price, 650);
  assert.equal(opt500?.price, 1250); // Not simply 2x 650
  assert.equal(optPack?.variantType, "pack");

  // 4. Test getProductBySlug
  const bySlug = await repo.getProductBySlug("prime-black-angus-ribeye");
  assert.ok(bySlug);
  assert.equal(bySlug?.id, "erp-prod-101");

  // 5. Test publication status gating: Unpublished ERP products must NOT be publicly displayed
  const unpublishedProduct: Product = {
    ...testProduct,
    id: "erp-prod-102",
    slug: "secret-wagyu-cut",
    name: "Secret Wagyu Cut",
    isPublished: false, // Unpublished!
  };
  upsertSyncedProduct(unpublishedProduct);

  const visibleList = await repo.listProducts();
  assert.equal(visibleList.length, 1, "Unpublished product must be filtered out");
  assert.equal(visibleList.find((p) => p.id === "erp-prod-102"), undefined);

  // 6. Cleanup
  removeSyncedProduct("erp-prod-101");
  removeSyncedProduct("erp-prod-102");
  clearSyncedCatalog();
});
