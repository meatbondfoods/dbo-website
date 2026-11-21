import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHmacSignature } from "../src/lib/server-hmac.ts";
import { processCatalogSyncEvent } from "../src/lib/catalog-sync-service.ts";
import {
  clearSyncedCatalog,
  SupabaseCatalogRepository,
} from "../src/lib/repositories/supabase-catalog.ts";
import { SupabaseOrderRepository } from "../src/lib/repositories/supabase.ts";
import type { OrderInput } from "../src/lib/domain/types.ts";

test("Catalog Sync Integration: HMAC verification, replay tolerance, variant pricing & checkout reflection", async () => {
  clearSyncedCatalog();
  const secret = process.env.WEB_ORDER_INTEGRATION_SECRET || "meatbond-secure-integration-key-2026";
  const catalogRepo = new SupabaseCatalogRepository();
  const orderRepo = new SupabaseOrderRepository(undefined, catalogRepo);

  const testProductPayload = {
    id: "sync-prod-88",
    slug: "chilled-bengal-mutton-chops",
    name: "Chilled Bengal Mutton Chops",
    categoryId: "cat-other",
    description: "Tender fresh mutton chops cut daily.",
    storageInstructions: "Keep refrigerated 0-4°C",
    images: ["/products/mutton-chops.jpg"],
    options: [
      { id: "opt-500g", label: "500 g Chops", grams: 500, price: 680, variantType: "weight", sku: "MUT-500G" },
      { id: "opt-1kg", label: "1 kg Family Pack", grams: 1000, price: 1300, variantType: "pack", sku: "MUT-1KG" },
    ],
    availability: "in_stock",
    tags: ["mutton", "chilled"],
    rating: 4.8,
    reviewCount: 15,
    isPublished: true,
  };

  const syncEvent = {
    eventId: `evt-test-${Date.now()}`,
    eventType: "catalog.product.upsert",
    timestamp: Date.now(),
    payload: testProductPayload,
  };

  const rawBody = JSON.stringify(syncEvent);
  const now = Date.now();
  const signature = computeHmacSignature(rawBody, secret, now);
  const idempKey = `idemp-sync-${Date.now()}`;

  // 1. Successful Webhook Processing
  const res = await processCatalogSyncEvent(
    rawBody,
    {
      signature,
      timestamp: String(now),
      idempotencyKey: idempKey,
    },
    secret
  );

  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.equal(res.data.eventId, syncEvent.eventId);

  // 2. Verify product is reflected in catalog repository
  const syncedProd = await catalogRepo.getProductBySlug("chilled-bengal-mutton-chops");
  assert.ok(syncedProd);
  assert.equal(syncedProd?.name, "Chilled Bengal Mutton Chops");
  assert.equal(syncedProd?.options[0]?.price, 680);

  // 3. Test checkout reflection: creating an order using this synced product prices at ৳680
  const orderInput: OrderInput = {
    customer: { name: "Tanvir Ahmed", phone: "01799887766" },
    address: { line1: "House 10, Road 4", area: "Chandgaon", city: "Chattagram" },
    paymentMethod: "cod",
    lines: [{ productId: "sync-prod-88", optionId: "opt-500g", quantity: 2 }],
  };

  const createdOrder = await orderRepo.createOrder(orderInput, `idemp-ord-${Date.now()}`);
  assert.equal(createdOrder.subtotal, 1360); // 680 * 2 = 1360
  assert.equal(createdOrder.status, "pending_confirmation");

  // 4. Update Price via ERP Sync: Change 500g price to ৳720
  const updatedPayload = {
    ...testProductPayload,
    options: [
      { id: "opt-500g", label: "500 g Chops", grams: 500, price: 720, variantType: "weight", sku: "MUT-500G" },
      { id: "opt-1kg", label: "1 kg Family Pack", grams: 1000, price: 1400, variantType: "pack", sku: "MUT-1KG" },
    ],
  };
  const updateEvent = {
    eventId: `evt-test-update-${Date.now()}`,
    eventType: "catalog.product.upsert",
    timestamp: Date.now(),
    payload: updatedPayload,
  };
  const updateRaw = JSON.stringify(updateEvent);
  const updateTime = Date.now();
  const updateSig = computeHmacSignature(updateRaw, secret, updateTime);

  const updateRes = await processCatalogSyncEvent(
    updateRaw,
    {
      signature: updateSig,
      timestamp: String(updateTime),
      idempotencyKey: `idemp-update-${Date.now()}`,
    },
    secret
  );

  assert.equal(updateRes.status, 200);

  // Subsequent order must now price at ৳720 * 2 = ৳1440
  const order2 = await orderRepo.createOrder(orderInput, `idemp-ord-v2-${Date.now()}`);
  assert.equal(order2.subtotal, 1440);

  // 5. Replay attack rejection: expired timestamp (> 5 mins)
  const oldTime = Date.now() - 6 * 60 * 1000;
  const oldSig = computeHmacSignature(rawBody, secret, oldTime);
  const oldRes = await processCatalogSyncEvent(
    rawBody,
    {
      signature: oldSig,
      timestamp: String(oldTime),
    },
    secret
  );
  assert.equal(oldRes.status, 401);

  // 6. Tampered payload rejection
  const badSigRes = await processCatalogSyncEvent(
    rawBody,
    {
      signature: "bad-signature-hex",
      timestamp: String(now),
    },
    secret
  );
  assert.equal(badSigRes.status, 401);

  clearSyncedCatalog();
});
