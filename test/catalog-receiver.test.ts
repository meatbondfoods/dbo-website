/**
 * Receiver tests on real PostgreSQL (PGlite) with the website's real migrations: signature and replay
 * checks, idempotency, conflicts, out-of-order rejection, projection persistence and RLS.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { websiteDb, mig } from "./helpers/pg-fixture.ts";
import { processCatalogSyncEvent, type CatalogApplier } from "../src/lib/catalog-sync-service.ts";
import { computeHmacSignature } from "../src/lib/server-hmac.ts";
import { loadSigningKeys, SyncConfigError } from "../src/lib/sync-config.ts";
import { SupabaseCatalogRepository } from "../src/lib/repositories/supabase-catalog.ts";
import { priceLines, OrderValidationError } from "../src/lib/pricing.ts";

const SECRET = "receiver-test-secret-0123456789abcdef-xy";
const keys = [{ keyId: "k1", secret: SECRET }];
let db: PGlite;

// A Supabase-shaped service client over PGlite, executing as service_role like production.
const applier: CatalogApplier = {
  async rpc(_fn, args) {
    try {
      await db.exec("set role service_role");
      try {
        const r = await db.query("select public.apply_catalog_event($1::jsonb, $2) as r", [JSON.stringify(args.p_event), args.p_body_hash]);
        return { data: (r.rows[0] as { r: unknown }).r, error: null };
      } finally {
        await db.exec("reset role");
      }
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },
};

const PID = "11111111-1111-4111-8111-111111111111";
const V500 = "22222222-2222-4222-8222-222222222222";
const V1K = "33333333-3333-4333-8333-333333333333";

function snapshot(over: Record<string, unknown> = {}, variants?: unknown[]) {
  return {
    id: PID, slug: "beef-curry-cut", name: "Beef Curry Cut", categoryId: "raw_meat", categoryName: "Raw Meat",
    description: "Fresh", images: [], tags: ["raw_meat"], sortOrder: 0, isPublished: true, availability: "in_stock",
    variants: variants ?? [
      { id: V500, sku: "BCC-500G", label: "500 g", variantType: "weight", grams: 500, uomFactor: 0.5, price: 470, isAvailable: true },
      { id: V1K, sku: "BCC-1KG", label: "1 kg", variantType: "weight", grams: 1000, uomFactor: 1, price: 900, isAvailable: true },
    ],
    ...over,
  };
}
let seq = 0;
const eventId = (): string => crypto.randomUUID();
function envelope(eventType: string, version: number, payload: unknown, id = eventId(), aggregateId = PID) {
  return JSON.stringify({ eventId: id, schemaVersion: 1, eventType, aggregateId, aggregateVersion: version, occurredAt: new Date(1_700_000_000_000 + ++seq * 1000).toISOString(), payload });
}
const upsert = (v: number, over = {}, variants?: unknown[], id?: string) => envelope("catalog.product.upsert", v, snapshot(over, variants), id);
const stock = (v: number, availability: string, variants: { id: string; isAvailable: boolean }[]) =>
  envelope("catalog.stock.update", v, { productId: PID, availability, variants });
const unpublish = (v: number) => envelope("catalog.product.unpublish", v, { productId: PID, reason: "unpublished" });

function signed(body: string, over: { ts?: number; keyId?: string; sig?: string } = {}) {
  const ts = over.ts ?? Date.now();
  return { signature: over.sig ?? computeHmacSignature(body, SECRET, ts), timestamp: String(ts), keyId: over.keyId ?? "k1" };
}
const send = (body: string, h = signed(body)) => processCatalogSyncEvent(body, h, { keys, db: applier });

const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, any>[];
const reset = async () => {
  await db.exec("truncate public.web_catalog_events, public.web_catalog_versions, public.web_catalog_products, public.web_catalog_categories cascade");
};

before(async () => { db = await websiteDb(); });

test("fail closed: no secret, short secret and the burned value are all refused", () => {
  assert.throws(() => loadSigningKeys({}), SyncConfigError);
  assert.throws(() => loadSigningKeys({ WEB_SYNC_SIGNING_SECRET: "short" }), SyncConfigError);
  assert.throws(() => loadSigningKeys({ WEB_ORDER_INTEGRATION_SECRET: ["meatbond", "secure", "integration", "key", "2026"].join("-") }), /compromised/);
  assert.equal(loadSigningKeys({ WEB_SYNC_SIGNING_SECRET: SECRET }).length, 1);
});

test("signature, key id, replay window and tampering are rejected before any database write", async () => {
  await reset();
  const body = upsert(1);
  const ok = signed(body);
  assert.equal((await send(body, { ...ok, signature: ok.signature.replace(/.$/, (c) => (c === "0" ? "1" : "0")) })).status, 401); // wrong signature
  assert.equal((await send(body, { ...ok, signature: ok.signature + "zz" })).status, 401);                                       // trailing garbage
  assert.equal((await send(body, { ...ok, keyId: "nope" })).status, 401);                                                          // unknown key id
  assert.equal((await send(body, signed(body, { ts: Date.now() - 6 * 60_000 }))).status, 401);                                      // replay window
  assert.equal((await send(body + " ", ok)).status, 401);                                                                          // tampered body
  assert.equal((await send(body, { signature: null, timestamp: null, keyId: null } as never)).status, 401);
  assert.equal((await q("select count(*)::int n from public.web_catalog_events"))[0].n, 0);
  assert.equal((await q("select count(*)::int n from public.web_catalog_products"))[0].n, 0);
});

test("a valid event persists the projection: ERP prices, ids, category, and unknown stock is never available", async () => {
  await reset();
  const r = await send(upsert(1, { availability: "out_of_stock" }, [
    { id: V500, sku: "BCC-500G", label: "500 g", variantType: "weight", grams: 500, uomFactor: 0.5, price: 470, isAvailable: false },
    { id: V1K, sku: "BCC-1KG", label: "1 kg", variantType: "weight", grams: 1000, uomFactor: 1, price: 900, compareAtPrice: 950, isAvailable: false },
  ]));
  assert.equal(r.status, 200);
  assert.equal(r.changed, true);
  const p = (await q("select * from public.web_catalog_products where id = $1", [PID]))[0];
  assert.equal(p.slug, "beef-curry-cut");
  assert.equal(p.is_published, true);
  assert.equal(p.availability, "out_of_stock");
  assert.deepEqual(p.options.map((o: any) => [o.id, o.sku, o.price, o.uomFactor, o.isAvailable]), [[V500, "BCC-500G", 470, 0.5, false], [V1K, "BCC-1KG", 900, 1, false]]);
  assert.equal(p.options[1].compareAtPrice, 950);
  assert.equal((await q("select name from public.web_catalog_categories where id = 'raw_meat'"))[0].name, "Raw Meat");
});

test("the same event delivered twice changes nothing the second time (idempotent)", async () => {
  await reset();
  const body = upsert(1);
  assert.equal((await send(body)).data.status, "applied");
  const again = await send(body);
  assert.equal(again.status, 200);
  assert.equal(again.changed, false);
  assert.equal(again.data.status, "duplicate");
  assert.equal((await q("select count(*)::int n from public.web_catalog_events"))[0].n, 1);
});

test("the same event id with a different body is a conflict and changes nothing", async () => {
  await reset();
  const id = eventId();
  assert.equal((await send(upsert(1, {}, undefined, id))).status, 200);
  const r = await send(upsert(2, { name: "Hacked" }, undefined, id));
  assert.equal(r.status, 409);
  assert.equal((await q("select name from public.web_catalog_products"))[0].name, "Beef Curry Cut");
});

test("out-of-order events are rejected: an older version never overwrites a newer one", async () => {
  await reset();
  assert.equal((await send(upsert(5, { name: "Version 5" }))).data.status, "applied");
  const old = await send(upsert(3, { name: "Version 3" }));
  assert.equal(old.status, 200);
  assert.equal(old.data.status, "stale");
  assert.equal(old.changed, false);
  assert.equal((await send(upsert(5, { name: "Same version, new event" }))).data.status, "stale");  // equal version is not newer
  assert.equal((await send(unpublish(4))).data.status, "stale");                                      // a late unpublish cannot hide a newer product
  const p = (await q("select name, is_published from public.web_catalog_products"))[0];
  assert.equal(p.name, "Version 5");
  assert.equal(p.is_published, true);
  assert.equal((await send(upsert(6, { name: "Version 6" }))).data.status, "applied");
  assert.equal((await q("select name from public.web_catalog_products"))[0].name, "Version 6");
});

test("a newer stock event never makes a late price update look stale (content and stock are guarded separately)", async () => {
  await reset();
  assert.equal((await send(upsert(1))).data.status, "applied");
  // Price change = v5 (retrying), stock change = v6 arrives first.
  assert.equal((await send(stock(6, "out_of_stock", [{ id: V500, isAvailable: false }, { id: V1K, isAvailable: false }]))).data.status, "applied");
  const late = await send(upsert(5, { availability: "in_stock" }, [
    { id: V500, sku: "BCC-500G", label: "500 g", variantType: "weight", grams: 500, uomFactor: 0.5, price: 520, isAvailable: true },
    { id: V1K, sku: "BCC-1KG", label: "1 kg", variantType: "weight", grams: 1000, uomFactor: 1, price: 900, isAvailable: true },
  ]));
  assert.equal(late.data.status, "applied");                       // the price update is NOT lost
  const p = (await q("select availability, options from public.web_catalog_products"))[0];
  assert.equal(p.options[0].price, 520);                           // new price applied
  assert.equal(p.availability, "out_of_stock");                     // but the newer stock state (v6) is kept
  assert.ok(p.options.every((o: any) => o.isAvailable === false));
});

test("stock events update availability and per-variant flags; stale stock is ignored", async () => {
  await reset();
  await send(upsert(1));
  assert.equal((await send(stock(2, "low_stock", [{ id: V500, isAvailable: true }, { id: V1K, isAvailable: false }]))).data.status, "applied");
  let p = (await q("select availability, options from public.web_catalog_products"))[0];
  assert.equal(p.availability, "low_stock");
  assert.deepEqual(p.options.map((o: any) => o.isAvailable), [true, false]);
  assert.equal((await send(stock(2, "in_stock", [{ id: V500, isAvailable: true }]))).data.status, "stale");
  p = (await q("select availability from public.web_catalog_products"))[0];
  assert.equal(p.availability, "low_stock");
});

test("unpublish hides the product from the public; a stock event for an unknown product is recorded, not shown", async () => {
  await reset();
  await send(upsert(1));
  assert.equal((await send(unpublish(2))).data.status, "applied");
  await db.exec("set role anon");
  try {
    assert.equal((await q("select count(*)::int n from public.web_catalog_products"))[0].n, 0);
  } finally { await db.exec("reset role"); }
  await reset();
  assert.equal((await send(stock(1, "in_stock", [{ id: V500, isAvailable: true }]))).data.status, "applied");
  assert.equal((await q("select count(*)::int n from public.web_catalog_products"))[0].n, 0);
});

test("invalid events are refused: bad schema, mismatched aggregate, unsupported type", async () => {
  await reset();
  assert.equal((await send(JSON.stringify({ eventType: "catalog.product.upsert" }))).status, 422);
  assert.equal((await send("not json")).status, 400);
  const mismatch = envelope("catalog.product.upsert", 1, snapshot(), eventId(), "99999999-9999-4999-8999-999999999999");
  assert.equal((await send(mismatch)).status, 422);
  const noPrice = upsert(1, {}, [{ id: V500, sku: "X-1", label: "x", variantType: "weight", grams: 500, uomFactor: 0.5, price: 0, isAvailable: true }]);
  assert.equal((await send(noPrice)).status, 422);   // a zero price is never accepted
  assert.equal((await q("select count(*)::int n from public.web_catalog_events"))[0].n, 0);
});

test("grants: the public cannot write the projection or call the apply function", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(() => db.query("select public.apply_catalog_event('{}'::jsonb, 'x')"), /permission denied/);
      await assert.rejects(() => db.query("insert into public.web_catalog_products (id, slug, name, category_id, availability) values ('x','x','x','raw_meat','in_stock')"), /permission denied|row-level/);
      await assert.rejects(() => db.query("select * from public.web_catalog_events"), /permission denied/);
      await assert.rejects(() => db.query("select * from public.web_catalog_versions"), /permission denied/);
    } finally { await db.exec("reset role"); }
  }
});

// A Supabase-shaped read client over PGlite that runs as the public `anon` role (RLS applies).
function anonReadClient() {
  return {
    from(table: string) {
      const state = { table, filters: [] as string[], params: [] as unknown[], order: "" };
      const run = async () => {
        await db.exec("set role anon");
        try {
          const r = await db.query(`select * from public.${state.table}${state.filters.length ? " where " + state.filters.join(" and ") : ""}${state.order}`, state.params);
          return { data: r.rows, error: null };
        } catch (e) { return { data: null, error: { message: (e as Error).message } }; }
        finally { await db.exec("reset role"); }
      };
      const builder: any = {
        select: () => builder,
        eq: (c: string, v: unknown) => { state.params.push(v); state.filters.push(`${c} = $${state.params.length}`); return builder; },
        order: (c: string) => { state.order = ` order by ${c}`; return builder; },
        then: (res: any, rej: any) => run().then(res, rej),
      };
      return builder;
    },
  };
}

test("storefront reads the persisted projection (anon + RLS): published only, ERP prices, no invented rating", async () => {
  await reset();
  await send(upsert(1));
  const repo = new SupabaseCatalogRepository(anonReadClient());
  const products = await repo.listProducts();
  assert.equal(products.length, 1);
  assert.equal(products[0].options[0].price, 470);
  assert.equal(products[0].rating, 0);
  assert.equal(products[0].reviewCount, 0);
  assert.equal((await repo.getProductBySlug("beef-curry-cut"))?.id, PID);
  assert.equal((await repo.listCategories()).some((c) => c.id === "raw_meat"), true);
  await send(unpublish(2));
  assert.deepEqual(await repo.listProducts(), []);   // connected but nothing published: empty, not demo data
});

test("checkout pricing is ERP-authoritative: projected price used, client price ignored, unavailable variants refused", async () => {
  await reset();
  await send(upsert(1, {}, [
    { id: V500, sku: "BCC-500G", label: "500 g", variantType: "weight", grams: 500, uomFactor: 0.5, price: 470, isAvailable: true },
    { id: V1K, sku: "BCC-1KG", label: "1 kg", variantType: "weight", grams: 1000, uomFactor: 1, price: 900, isAvailable: false },
  ]));
  const products = await new SupabaseCatalogRepository(anonReadClient()).listProducts();
  assert.equal(priceLines([{ productId: PID, optionId: V500, quantity: 2 }], products).subtotal, 940);
  assert.throws(() => priceLines([{ productId: PID, optionId: V1K, quantity: 1 }], products), OrderValidationError);   // variant out of stock
  assert.throws(() => priceLines([{ productId: PID, optionId: "forged", quantity: 1 }], products), OrderValidationError);
  assert.throws(() => priceLines([{ productId: "no-such-product", optionId: V500, quantity: 1 }], products), OrderValidationError);
});

test("migration 104 rolls back (with confirmation) and re-applies cleanly", async () => {
  const fresh = await websiteDb();
  await assert.rejects(() => fresh.exec(mig("104_catalog_projection_rollback.sql")), /Refusing to drop/);
  await fresh.exec("rollback");   // the refused script left its transaction open
  await fresh.exec("set app.confirm_catalog_projection_drop = 'yes'");
  await fresh.exec(mig("104_catalog_projection_rollback.sql"));
  assert.equal(((await fresh.query("select count(*)::int n from information_schema.tables where table_name like 'web_catalog_%'")).rows[0] as any).n, 0);
  await fresh.exec(mig("104_catalog_projection.sql"));
  assert.equal(((await fresh.query("select count(*)::int n from information_schema.tables where table_name like 'web_catalog_%'")).rows[0] as any).n, 4);
});
