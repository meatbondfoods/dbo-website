import test from "node:test";
import assert from "node:assert/strict";
import { SupabaseOrderRepository, resolveWebsiteDb } from "../src/lib/repositories/supabase.ts";
import { verifyHmacSignature } from "../src/lib/server-hmac.ts";
import { MemoryDispatchStore } from "../src/lib/order-dispatch.ts";
import type { OrderInput, Product } from "../src/lib/domain/types.ts";

const VARIANT = "22222222-2222-4222-8222-222222222222";
const SECRET = "dispatch-test-secret-0123456789abcdef-x";
const product: Product = {
  id: "11111111-1111-4111-8111-111111111111", slug: "beef", name: "Beef", categoryId: "raw_meat", description: "", images: [],
  options: [{ id: VARIANT, label: "500 g", grams: 500, price: 470, sku: "B-500G", isAvailable: true }],
  availability: "in_stock", tags: [], rating: 0, reviewCount: 0,
};
const input: OrderInput = {
  customer: { name: "Test Customer", phone: "01700000000" },
  address: { line1: "Road 1", area: "Banasree", city: "Dhaka" },
  paymentMethod: "cod",
  lines: [{ productId: product.id, optionId: VARIANT, quantity: 2 }],
} as OrderInput;

async function withEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const keys = ["WEB_SYNC_SIGNING_SECRET", "WEB_ORDER_INTEGRATION_SECRET", "ERP_INTEGRATION_URL", "WEB_SYNC_KEY_ID"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  try { return await fn(); } finally {
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test("order dispatch fails closed without a secret: nothing is sent, checkout still succeeds", async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response("{}"); }) as typeof fetch;
  try {
    await withEnv({}, async () => {
      const repo = new SupabaseOrderRepository([product], undefined, new MemoryDispatchStore());
      const order = await repo.createOrder(input, "idem-key-0000000000000001");
      assert.equal(order.subtotal, 940);                       // priced from the catalogue, not the client
      assert.equal(calls, 0);
    });
    // The burned legacy value is refused as well.
    await withEnv({ WEB_ORDER_INTEGRATION_SECRET: ["meatbond", "secure", "integration", "key", "2026"].join("-") }, async () => {
      await new SupabaseOrderRepository([product], undefined, new MemoryDispatchStore()).createOrder(input, "idem-key-0000000000000002");
      assert.equal(calls, 0);
    });
  } finally { globalThis.fetch = realFetch; }
});

test("order dispatch sends a signed order with the ERP variant id and key id", async () => {
  const realFetch = globalThis.fetch;
  const sent: { url: string; headers: Record<string, string>; body: string }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), headers: init.headers as Record<string, string>, body: String(init.body) });
    return new Response('{"success":true}', { status: 201 });
  }) as typeof fetch;
  try {
    await withEnv({ WEB_SYNC_SIGNING_SECRET: SECRET, ERP_INTEGRATION_URL: "https://erp.example.test/api/integrations/web-orders" }, async () => {
      await new SupabaseOrderRepository([product], undefined, new MemoryDispatchStore()).createOrder(input, "idem-key-0000000000000003");
    });
  } finally { globalThis.fetch = realFetch; }
  assert.equal(sent.length, 1);
  const { headers, body } = sent[0];
  assert.equal(headers["x-meatbond-key-id"], "k1");
  assert.equal(verifyHmacSignature(body, SECRET, headers["x-meatbond-timestamp"], headers["x-meatbond-signature"]).valid, true);
  const payload = JSON.parse(body);
  assert.equal(payload.lines[0].variantId, VARIANT);
  assert.equal(payload.lines[0].submittedUnitPrice, 470);
  assert.equal(payload.total, payload.subtotal + payload.deliveryCharge);
});

test("a non-UUID option id (demo catalogue) is sent without a variant id, never guessed", async () => {
  const realFetch = globalThis.fetch;
  let body = "";
  globalThis.fetch = (async (_u: string, init: RequestInit) => { body = String(init.body); return new Response("{}", { status: 201 }); }) as typeof fetch;
  const demo: Product = { ...product, options: [{ id: "opt-500g", label: "500 g", grams: 500, price: 470 }] };
  try {
    await withEnv({ WEB_SYNC_SIGNING_SECRET: SECRET, ERP_INTEGRATION_URL: "https://erp.example.test/x" }, async () => {
      await new SupabaseOrderRepository([demo], undefined, new MemoryDispatchStore()).createOrder({ ...input, lines: [{ productId: demo.id, optionId: "opt-500g", quantity: 1 }] } as OrderInput, "idem-key-0000000000000004");
    });
  } finally { globalThis.fetch = realFetch; }
  assert.equal(JSON.parse(body).lines[0].variantId, undefined);
});

test("the website refuses to be configured with the ERP's Supabase project", () => {
  assert.equal(resolveWebsiteDb({}, false), null);
  assert.equal(resolveWebsiteDb({ NEXT_PUBLIC_SUPABASE_URL: "https://web.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }, true), null);
  assert.deepEqual(resolveWebsiteDb({ NEXT_PUBLIC_SUPABASE_URL: "https://web.example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }, false), { url: "https://web.example.supabase.co", key: "k" });
  assert.throws(() => resolveWebsiteDb({ NEXT_PUBLIC_SUPABASE_URL: "https://baifeezugzfkomjnmfgq.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }, false), /ERP's Supabase project/);
  assert.throws(() => resolveWebsiteDb({ SUPABASE_URL: "https://baifeezugzfkomjnmfgq.supabase.co" }, false), /ERP's Supabase project/);
});
