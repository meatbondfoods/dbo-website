import test from "node:test";
import assert from "node:assert/strict";
import { computeHmacSignature, verifyHmacSignature } from "../src/lib/server-hmac.ts";
import { SupabaseOrderRepository } from "../src/lib/repositories/supabase.ts";
import type { OrderInput, Product } from "../src/lib/domain/types.ts";
import { formatOrderReference, normalizeBdPhone } from "../src/lib/identity.ts";

const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-beef-curry",
    slug: "beef-curry-cut",
    name: "Beef Curry Cut",
    categoryId: "cat-beef",
    description: "Premium diced beef",
    images: ["/beef.jpg"],
    options: [
      { id: "opt-500g", label: "500g", grams: 500, price: 475 },
      { id: "opt-1kg", label: "1kg", grams: 1000, price: 900 },
    ],
    availability: "in_stock",
    tags: ["fresh"],
    rating: 4.8,
    reviewCount: 12,
  },
];

test("HMAC SHA-256 server-to-server signature and replay protection", async (t) => {
  const secret = "test-secret-key-12345";
  const payload = JSON.stringify({ orderRef: "MBM-ORD-2026-000001", total: 950 });
  const now = Date.now();

  await t.test("generates and verifies valid signature", () => {
    const sig = computeHmacSignature(payload, secret, now);
    assert.equal(typeof sig, "string");
    assert.equal(sig.length, 64); // SHA-256 hex string

    const result = verifyHmacSignature(payload, secret, String(now), sig);
    assert.equal(result.valid, true);
  });

  await t.test("rejects tampered payload", () => {
    const sig = computeHmacSignature(payload, secret, now);
    const tampered = JSON.stringify({ orderRef: "MBM-ORD-2026-000001", total: 100 });
    const result = verifyHmacSignature(tampered, secret, String(now), sig);
    assert.equal(result.valid, false);
  });

  await t.test("rejects incorrect secret", () => {
    const sig = computeHmacSignature(payload, "wrong-secret", now);
    const result = verifyHmacSignature(payload, secret, String(now), sig);
    assert.equal(result.valid, false);
  });

  await t.test("rejects expired timestamp (replay protection > 5 mins)", () => {
    const sixMinutesAgo = now - 6 * 60 * 1000;
    const sig = computeHmacSignature(payload, secret, sixMinutesAgo);
    const result = verifyHmacSignature(payload, secret, String(sixMinutesAgo), sig);
    assert.equal(result.valid, false);
    assert.match(result.reason || "", /tolerance window/i);
  });

  await t.test("rejects future timestamp (> 5 mins into future)", () => {
    const tenMinutesFuture = now + 10 * 60 * 1000;
    const sig = computeHmacSignature(payload, secret, tenMinutesFuture);
    const result = verifyHmacSignature(payload, secret, String(tenMinutesFuture), sig);
    assert.equal(result.valid, false);
    assert.match(result.reason || "", /tolerance window/i);
  });

  await t.test("rejects missing headers or invalid hex", () => {
    assert.equal(verifyHmacSignature(payload, secret, null, "abcd").valid, false);
    assert.equal(verifyHmacSignature(payload, secret, String(now), null).valid, false);
    assert.equal(verifyHmacSignature(payload, secret, "not-a-number", "abcd").valid, false);
  });
});

test("SupabaseOrderRepository checkout persistence and idempotency", async (t) => {
  const repo = new SupabaseOrderRepository(MOCK_PRODUCTS);

  const sampleInput: OrderInput = {
    customer: {
      name: "Tariqul Islam",
      phone: "01711223344",
      email: "tariq@example.com",
    },
    address: {
      line1: "House 12, Road 4, Sector 3",
      area: "Uttara",
      city: "Dhaka",
      notes: "Ring the bell",
    },
    paymentMethod: "cod",
    lines: [
      { productId: "prod-beef-curry", optionId: "opt-1kg", quantity: 2 },
    ],
  };

  const idempotencyKey = `idemp-test-key-${Date.now()}`;

  await t.test("creates order with authoritative pricing and valid reference", async () => {
    const order = await repo.createOrder(sampleInput, idempotencyKey);

    assert.ok(order.id);
    assert.match(order.reference, /^MBM-ORD-\d{4}-\d{6}$/);
    assert.equal(order.status, "pending_confirmation");
    assert.equal(order.paymentStatus, "unpaid");
    // 2 * 900 = 1800 subtotal
    assert.equal(order.subtotal, 1800);
    assert.equal(order.total, order.subtotal + order.deliveryCharge);
    assert.equal(order.input.customer.name, "Tariqul Islam");
  });

  await t.test("enforces strict idempotency (same key returns identical order)", async () => {
    const order1 = await repo.createOrder(sampleInput, idempotencyKey);
    const order2 = await repo.createOrder(sampleInput, idempotencyKey);

    assert.equal(order1.id, order2.id);
    assert.equal(order1.reference, order2.reference);
    assert.equal(order1.total, order2.total);
  });

  await t.test("retrieves order by reference and normalized phone", async () => {
    const created = await repo.createOrder(sampleInput, idempotencyKey);

    // Exact phone match
    const found1 = await repo.getOrderByReference(created.reference, "01711223344");
    assert.ok(found1);
    assert.equal(found1?.id, created.id);

    // E.164 normalized phone match
    const found2 = await repo.getOrderByReference(created.reference, "+8801711223344");
    assert.ok(found2);
    assert.equal(found2?.id, created.id);

    // Wrong phone returns null (cannot enumerate references)
    const notFound = await repo.getOrderByReference(created.reference, "01999999999");
    assert.equal(notFound, null);
  });

  await t.test("gracefully handles unreachable ERP endpoint without failing checkout", async () => {
    // Should complete cleanly even if ERP is offline
    const uniqueKey = "idemp-offline-test-" + Date.now();
    const order = await repo.createOrder(sampleInput, uniqueKey);
    assert.ok(order.id);
    assert.equal(order.status, "pending_confirmation");
  });
});
