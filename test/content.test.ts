import test from "node:test";
import assert from "node:assert/strict";
import { checkTheme, contrast } from "../src/lib/content/contrast.ts";
import { SCHEMAS, CONTENT_KEYS } from "../src/lib/content/schema.ts";
import { DEFAULTS } from "../src/lib/content/defaults.ts";
import { applyDisplay } from "../src/lib/content/display.ts";
import { areaDistance, deliveryCharge, deliveryNote, deliverySummary } from "../src/lib/pricing.ts";

const cfg = { active: true, freeRadiusKm: 7, chargeBeyond: 80, freeOverAmount: 1500, areas: [{ name: "Gulshan", distanceKm: 4 }, { name: "Uttara", distanceKm: 12 }, { name: "Edge", distanceKm: 7 }] };

test("every built-in default validates against its schema", () => {
  for (const k of CONTENT_KEYS) assert.equal(SCHEMAS[k].safeParse(DEFAULTS[k]).success, true, k);
});

test("the official brand palette passes every WCAG 4.5:1 text pairing", () => {
  const results = checkTheme(DEFAULTS.theme);
  assert.deepEqual(results.filter((r) => !r.pass), []);
  assert.ok(contrast("#000000", "#FFFFFF") > 20.9);
});

test("a theme with unreadable text is flagged", () => {
  const bad = checkTheme({ ...DEFAULTS.theme, brand: "#9FD8B5", ink: "#B8C4BC" });
  const failing = bad.filter((r) => !r.pass).map((r) => r.label);
  assert.ok(failing.some((l) => l.includes("Primary buttons")));
  assert.ok(failing.some((l) => l.includes("Body text")));
});

test("schemas reject unsafe or malformed content", () => {
  const hero = { ...DEFAULTS.hero };
  assert.equal(SCHEMAS.hero.safeParse({ ...hero, primaryHref: "javascript:alert(1)" }).success, false);
  assert.equal(SCHEMAS.hero.safeParse({ ...hero, primaryHref: "http://insecure.example" }).success, false);
  assert.equal(SCHEMAS.hero.safeParse({ ...hero, primaryHref: "//evil.example/phish" }).success, false);   // protocol-relative = off-site
  assert.equal(SCHEMAS.hero.safeParse({ ...hero, primaryHref: "//faqs" }).success, false);
  assert.equal(SCHEMAS.hero.safeParse({ ...hero, primaryHref: "/" }).success, true);
  assert.equal(SCHEMAS.hero.safeParse({ ...hero, primaryHref: "/shop?category=chicken-cuts" }).success, true);
  assert.equal(SCHEMAS.hero.safeParse({ ...hero, imagePath: "/../secret" }).success, false);
  assert.equal(SCHEMAS.hero.safeParse({ ...hero, primaryHref: "https://example.com/x" }).success, true);
  assert.equal(SCHEMAS.theme.safeParse({ ...DEFAULTS.theme, brand: "red" }).success, false);
  assert.equal(SCHEMAS.theme.safeParse({ ...DEFAULTS.theme, brand: "#12" }).success, false);
  assert.equal(SCHEMAS.site.safeParse({ ...DEFAULTS.site, facebook: "javascript:x" }).success, false);
  assert.equal(SCHEMAS.commerce.safeParse({ ...cfg, chargeBeyond: -5 }).success, false);
});

test("delivery: free within the radius (boundary included), charged beyond", () => {
  assert.equal(deliveryCharge(300, 4, cfg), 0);
  assert.equal(deliveryCharge(300, 7, cfg), 0);            // exactly 7 km is free
  assert.equal(deliveryCharge(300, 7.01, cfg), 80);
  assert.equal(deliveryCharge(300, 12, cfg), 80);
});

test("delivery: optional free-over-amount rule and its off switch", () => {
  assert.equal(deliveryCharge(1500, 12, cfg), 0);
  assert.equal(deliveryCharge(1499, 12, cfg), 80);
  assert.equal(deliveryCharge(99999, 12, { ...cfg, freeOverAmount: 0 }), 80);   // 0 disables the rule
});

test("delivery: an unlisted area has unknown distance and is charged", () => {
  assert.equal(areaDistance("Atlantis", cfg), null);
  assert.equal(deliveryCharge(300, null, cfg), 80);
  assert.equal(areaDistance("  gulshan ", cfg), 4);       // case and whitespace insensitive
});

test("delivery policy is INACTIVE by default: no charge is applied and nothing is promised", () => {
  assert.equal(DEFAULTS.commerce.active, false);
  assert.deepEqual(DEFAULTS.commerce.areas, []);
  const off = { ...cfg, active: false };
  assert.equal(deliveryCharge(300, 12, off), 0);                 // inactive: even a far, small order has no website-applied charge
  assert.equal(deliveryCharge(300, null, off), 0);
  assert.equal(deliverySummary(off), "Delivery charge is confirmed by our team");
  assert.match(deliveryNote(off), /not been announced/);
  for (const s of [deliverySummary(DEFAULTS.commerce), deliveryNote(DEFAULTS.commerce)]) assert.doesNotMatch(s, /৳|km|free/i);
});

test("delivery summary is generated from the configuration", () => {
  assert.equal(deliverySummary(cfg), "Free delivery within 7 km, else ৳80 (free over ৳1,500)");
  assert.equal(deliverySummary({ ...cfg, freeOverAmount: 0 }), "Free delivery within 7 km, else ৳80");
});

const mk = (id: string, extra: Partial<{ availability: "in_stock" | "out_of_stock"; tags: string[] }> = {}) => ({
  id, slug: id, name: id, categoryId: "c", description: "", images: [], options: [], availability: "in_stock" as const, tags: [], rating: 5, reviewCount: 1, ...extra,
});

test("display settings hide, order and label products without touching price or stock", () => {
  const products = [mk("a"), mk("b"), mk("c", { availability: "out_of_stock" })];
  const out = applyDisplay(products, { items: [
    { productId: "a", visible: false, featured: false, bestSeller: false, promoLabel: "", sortOrder: 10 },
    { productId: "b", visible: true, featured: true, bestSeller: false, promoLabel: "New", sortOrder: 5 },
  ] });
  assert.deepEqual(out.visible.map((p) => p.id), ["b", "c"]);          // a hidden, b sorted first
  assert.equal(out.visible[0].badge, "New");
  assert.deepEqual(out.featured.map((p) => p.id), ["b"]);
  assert.equal(out.visible[0].availability, "in_stock");               // ERP-owned fields unchanged
});

test("with no explicit flags the site picks featured products automatically (never sold-out)", () => {
  const out = applyDisplay([mk("a"), mk("b", { availability: "out_of_stock" }), mk("c", { tags: ["bestseller"] })], { items: [] });
  assert.deepEqual(out.featured.map((p) => p.id), ["a", "c"]);
  assert.deepEqual(out.best.map((p) => p.id), ["c"]);
});
