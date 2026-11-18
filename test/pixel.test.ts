import test from "node:test";
import assert from "node:assert/strict";
import {
  getMetaPixelId,
  hasMarketingConsent,
  hasOrderBeenTracked,
  markOrderAsTracked,
  trackPageView,
  trackViewContent,
  trackAddToCart,
  trackInitiateCheckout,
  trackPurchase,
  fbq,
} from "../src/lib/meta-pixel.ts";

// Setup mock window & storage for Node test environment
function setupMockBrowser() {
  const sessionStorageMap = new Map<string, string>();
  const localStorageMap = new Map<string, string>();
  const calls: unknown[][] = [];

  const mockWindow: Record<string, unknown> = {
    sessionStorage: {
      getItem: (k: string) => sessionStorageMap.get(k) ?? null,
      setItem: (k: string, v: string) => sessionStorageMap.set(k, v),
      removeItem: (k: string) => sessionStorageMap.delete(k),
      clear: () => sessionStorageMap.clear(),
    },
    localStorage: {
      getItem: (k: string) => localStorageMap.get(k) ?? null,
      setItem: (k: string, v: string) => localStorageMap.set(k, v),
      removeItem: (k: string) => localStorageMap.delete(k),
      clear: () => localStorageMap.clear(),
    },
    fbq: (...args: unknown[]) => {
      calls.push(args);
    },
  };

  (globalThis as unknown as { window: unknown }).window = mockWindow;
  (globalThis as unknown as { sessionStorage: unknown }).sessionStorage = mockWindow.sessionStorage;
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockWindow.localStorage;

  return { calls, sessionStorageMap, localStorageMap };
}

test("pixel id is read from environment variable", () => {
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1186794784134642";
  assert.equal(getMetaPixelId(), "1186794784134642");
});

test("marketing consent defaults to true and respects explicit denial", () => {
  const { localStorageMap } = setupMockBrowser();

  // Default when unset
  assert.equal(hasMarketingConsent(), true);

  // When rejected or denied
  localStorageMap.set("mbm_cookie_consent", "rejected");
  assert.equal(hasMarketingConsent(), false);

  localStorageMap.set("mbm_cookie_consent", "denied");
  assert.equal(hasMarketingConsent(), false);

  // When accepted
  localStorageMap.set("mbm_cookie_consent", "accepted");
  assert.equal(hasMarketingConsent(), true);
});

test("trackPageView emits standard PageView event", () => {
  const { calls } = setupMockBrowser();
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1186794784134642";

  trackPageView();

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["track", "PageView"]);
});

test("trackViewContent formats product payload without personal data", () => {
  const { calls } = setupMockBrowser();
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1186794784134642";

  trackViewContent({
    id: "prod-broiler-01",
    name: "Whole Broiler Chicken",
    price: 340,
    category: "Poultry",
  });

  assert.equal(calls.length, 1);
  const [method, eventName, payload] = calls[0] as [string, string, Record<string, unknown>];
  assert.equal(method, "track");
  assert.equal(eventName, "ViewContent");
  assert.equal(payload.content_name, "Whole Broiler Chicken");
  assert.equal(payload.content_category, "Poultry");
  assert.deepEqual(payload.content_ids, ["prod-broiler-01"]);
  assert.equal(payload.content_type, "product");
  assert.equal(payload.value, 340);
  assert.equal(payload.currency, "BDT");

  // Ensure no PII keys exist
  assert.equal(payload.email, undefined);
  assert.equal(payload.phone, undefined);
  assert.equal(payload.address, undefined);
});

test("trackAddToCart computes value and contents correctly", () => {
  const { calls } = setupMockBrowser();
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1186794784134642";

  trackAddToCart({
    id: "prod-beef-01",
    name: "Premium Beef Ribs",
    price: 950,
    quantity: 3,
    category: "Beef",
  });

  assert.equal(calls.length, 1);
  const [method, eventName, payload] = calls[0] as [string, string, Record<string, unknown>];
  assert.equal(method, "track");
  assert.equal(eventName, "AddToCart");
  assert.equal(payload.value, 2850); // 950 * 3
  assert.equal(payload.currency, "BDT");
  assert.deepEqual(payload.contents, [{ id: "prod-beef-01", quantity: 3, item_price: 950 }]);
});

test("trackInitiateCheckout aggregates items and total value", () => {
  const { calls } = setupMockBrowser();
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1186794784134642";

  trackInitiateCheckout({
    items: [
      { id: "p1", name: "Chicken", price: 340, quantity: 2 },
      { id: "p2", name: "Beef", price: 950, quantity: 1 },
    ],
    subtotal: 1630,
    currency: "BDT",
  });

  assert.equal(calls.length, 1);
  const [method, eventName, payload] = calls[0] as [string, string, Record<string, unknown>];
  assert.equal(method, "track");
  assert.equal(eventName, "InitiateCheckout");
  assert.deepEqual(payload.content_ids, ["p1", "p2"]);
  assert.equal(payload.num_items, 3);
  assert.equal(payload.value, 1630);
  assert.equal(payload.currency, "BDT");
});

test("trackPurchase fires once with order eventID, and blocks duplicate submissions", () => {
  const { calls } = setupMockBrowser();
  process.env.NEXT_PUBLIC_META_PIXEL_ID = "1186794784134642";

  const orderRef = "MBM-ORD-2026-000042";

  assert.equal(hasOrderBeenTracked(orderRef), false);

  const firstCallResult = trackPurchase({
    reference: orderRef,
    total: 1630,
    items: [
      { id: "p1", price: 340, quantity: 2 },
      { id: "p2", price: 950, quantity: 1 },
    ],
  });

  assert.equal(firstCallResult, true);
  assert.equal(calls.length, 1);

  const [method, eventName, payload, options] = calls[0] as [
    string,
    string,
    Record<string, unknown>,
    Record<string, unknown>,
  ];

  assert.equal(method, "track");
  assert.equal(eventName, "Purchase");
  assert.equal(payload.value, 1630);
  assert.equal(payload.currency, "BDT");
  assert.equal(payload.num_items, 3);
  assert.deepEqual(options, { eventID: orderRef });

  // Order is now tracked
  assert.equal(hasOrderBeenTracked(orderRef), true);

  // Second call (simulating page reload or duplicate event) MUST be blocked
  const secondCallResult = trackPurchase({
    reference: orderRef,
    total: 1630,
    items: [
      { id: "p1", price: 340, quantity: 2 },
      { id: "p2", price: 950, quantity: 1 },
    ],
  });

  assert.equal(secondCallResult, false);
  assert.equal(calls.length, 1); // Still exactly 1 call
});
