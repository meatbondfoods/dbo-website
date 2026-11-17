import test from "node:test";
import assert from "node:assert/strict";
import { MAX_IMAGE_BYTES, sniffImage, validateImage } from "../src/lib/media.ts";
import { SCHEMAS, CONTENT_KEYS, SECTION_IDS } from "../src/lib/content/schema.ts";
import { DEFAULTS } from "../src/lib/content/defaults.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);

test("images are recognised by their bytes, not by their name or claimed type", () => {
  assert.equal(sniffImage(png)?.ext, "png");
  assert.equal(sniffImage(jpg)?.ext, "jpg");
  assert.equal(sniffImage(webp)?.ext, "webp");
});

test("SVG, HTML, scripts, GIF and random bytes are refused", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  for (const bad of [enc('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), enc("<html><script>x</script></html>"), enc("GIF89a....."), enc("MZ\x90\x00 executable"), Uint8Array.from([1, 2, 3, 4, 5])]) {
    assert.equal(validateImage(bad).ok, false);
  }
  assert.equal(validateImage(new Uint8Array(0)).ok, false);
});

test("files larger than 2 MB are refused even when they are real images", () => {
  const big = new Uint8Array(MAX_IMAGE_BYTES + 1); big.set(png);
  const r = validateImage(big);
  assert.equal(r.ok, false);
  const okSize = new Uint8Array(MAX_IMAGE_BYTES); okSize.set(png);
  assert.equal(validateImage(okSize).ok, true);
});

test("a PNG header hidden behind a .svg-style payload cannot pass as something else", () => {
  const polyglot = new TextEncoder().encode("<svg onload=alert(1)></svg>");
  assert.equal(sniffImage(polyglot), null);
});

test("new CMS content defaults are valid and make no delivery promise", () => {
  for (const k of CONTENT_KEYS) assert.equal(SCHEMAS[k].safeParse(DEFAULTS[k]).success, true, k);
  assert.deepEqual(DEFAULTS.sections.items.map((s) => s.id).sort(), [...SECTION_IDS].sort());
  const banner = JSON.stringify(DEFAULTS.banners) + JSON.stringify(DEFAULTS.site) + JSON.stringify(DEFAULTS.hero);
  assert.doesNotMatch(banner, /৳\s*\d|\b7\s*km\b|free delivery/i);
});

test("banner, navigation, section, seo and brand schemas reject unsafe input", () => {
  const b = DEFAULTS.banners.items[0];
  assert.equal(SCHEMAS.banners.safeParse({ items: [{ ...b, ctaHref: "javascript:alert(1)" }] }).success, false);
  assert.equal(SCHEMAS.banners.safeParse({ items: [{ ...b, imagePath: "/uploads/../../etc/passwd" }] }).success, false);
  assert.equal(SCHEMAS.banners.safeParse({ items: [{ ...b, imagePath: "http://insecure.example/x.png" }] }).success, false);
  assert.equal(SCHEMAS.banners.safeParse({ items: Array.from({ length: 6 }, (_, i) => ({ ...b, id: `b${i}` })) }).success, false);   // max 5
  assert.equal(SCHEMAS.banners.safeParse({ items: [{ ...b, imagePath: "/uploads/abc.png" }] }).success, true);
  assert.equal(SCHEMAS.navigation.safeParse({ showCategories: true, items: [{ label: "X", href: "data:text/html,x" }] }).success, false);
  assert.equal(SCHEMAS.sections.safeParse({ items: [{ id: "unknown", visible: true, title: "" }] }).success, false);
  assert.equal(SCHEMAS.seo.safeParse({ ...DEFAULTS.seo, siteTitle: "x" }).success, false);
  assert.equal(SCHEMAS.brand.safeParse({ logoPath: "javascript:x", logoAlt: "" }).success, false);
  assert.equal(SCHEMAS.brand.safeParse({ logoPath: "", logoAlt: "MeatBond Mart" }).success, true);   // blank = keep the wordmark
});
