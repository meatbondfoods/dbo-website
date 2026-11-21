/**
 * The website's migration chain from an EMPTY database on real PostgreSQL (PGlite): it needs nothing
 * from the ERP, every file applies, the projection / ledger / order queue exist, RLS and grants
 * protect customer data, and the rollbacks reverse cleanly and re-apply.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { emptyWebsiteDb, mig, WEBSITE_CHAIN } from "./helpers/pg-fixture.ts";

const rows = async (db: PGlite, sql: string) => (await db.query<any>(sql)).rows as Record<string, any>[];
let db: PGlite;

before(async () => {
  db = await emptyWebsiteDb();
});

test("the fixture's chain lists every numbered website migration", () => {
  assert.deepEqual(WEBSITE_CHAIN, ["101_web_customers.sql", "103_website_order_inbox.sql", "104_catalog_projection.sql", "105_order_dispatch_queue.sql", "106_customer_tables_rls.sql"]);
});

test("every website migration applies from an empty database with nothing from the ERP", async () => {
  const failures: string[] = [];
  for (const f of WEBSITE_CHAIN) {
    try {
      await db.exec(mig(f));
    } catch (e) {
      failures.push(`${f}: ${String((e as Error).message).slice(0, 160)}`);
      await db.exec("rollback").catch(() => undefined);
    }
  }
  assert.deepEqual(failures, []);
});

test("isolation: no ERP table exists in the website database and no foreign key leaves the project", async () => {
  const tables = (await rows(db, `select table_name from information_schema.tables where table_schema='public'`)).map((r) => r.table_name);
  for (const erpOnly of ["products", "customers", "sales_orders", "sales_order_items", "inventory_levels", "user_profiles", "audit_logs", "permission_actions"]) {
    assert.ok(!tables.includes(erpOnly), `the website database must not contain the ERP table ${erpOnly}`);
  }
  const fks = await rows(db, `select conrelid::regclass::text t, confrelid::regclass::text r from pg_constraint where contype='f'`);
  const allowed = new Set(tables.map((t) => `public.${t}`).concat(tables, ["auth.users"]));
  assert.deepEqual(fks.filter((f) => !allowed.has(f.r) && !allowed.has(`public.${f.r}`)), []);
  // No function body calls an ERP-only helper.
  const erpCalls = await rows(db, `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and (prosrc ilike '%has_permission(%' or prosrc ilike '%is_super_admin(%' or prosrc ilike '%require_permission(%')`);
  assert.deepEqual(erpCalls, []);
});

test("the event ledger, product projection and durable order queue exist with their indexes and functions", async () => {
  const tables = new Set((await rows(db, `select table_name from information_schema.tables where table_schema='public'`)).map((r) => r.table_name));
  for (const t of ["web_catalog_events", "web_catalog_versions", "web_catalog_products", "web_catalog_categories", "web_order_dispatch", "web_orders", "web_order_items", "web_order_events", "web_customers", "web_customer_addresses"]) {
    assert.ok(tables.has(t), `missing table ${t}`);
  }
  const fns = new Set((await rows(db, `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`)).map((r) => r.proname));
  for (const f of ["apply_catalog_event", "enqueue_order_dispatch", "claim_order_dispatch", "mark_order_dispatch_sent", "mark_order_dispatch_failed", "next_web_order_ref", "register_web_customer", "get_public_order_tracking"]) {
    assert.ok(fns.has(f), `missing function ${f}`);
  }
  const idx = new Set((await rows(db, `select indexname from pg_indexes where schemaname='public'`)).map((r) => r.indexname));
  for (const i of ["idx_web_catalog_products_published", "idx_web_catalog_events_aggregate", "idx_web_order_dispatch_due"]) assert.ok(idx.has(i), `missing index ${i}`);
});

test("every table in the website database has row-level security enabled", async () => {
  const off = (await rows(db, `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity order by 1`)).map((r) => r.relname);
  assert.deepEqual(off, []);
});

test("anonymous users cannot read or write customer, order or counter data", async () => {
  await db.exec("set role anon");
  try {
    // No API access at all: the privileges are revoked, so even reading fails.
    for (const t of ["web_customers", "web_customer_addresses", "web_order_counters", "web_migration_103_registry", "web_order_dispatch", "web_catalog_events", "web_catalog_versions"]) {
      await assert.rejects(() => db.query<any>(`select * from public.${t}`), /permission denied/, `anon could read ${t}`);
    }
    // Order tables: row-level security with no policy for the public = default deny.
    for (const t of ["web_orders", "web_order_items", "web_order_events"]) {
      const rls = (await rows(db, `select relrowsecurity r from pg_class where oid = 'public.${t}'::regclass`))[0].r;
      assert.equal(rls, true, `${t} must have RLS`);
      const open = await rows(db, `select policyname from pg_policies where schemaname='public' and tablename='${t}' and (roles::text ~ 'anon|public' or (qual = 'true' and roles::text !~ 'service_role'))`);
      assert.deepEqual(open, [], `${t} has a policy open to the public`);
    }
    await assert.rejects(() => db.query<any>(`insert into public.web_customers (auth_user_id, full_name, email, email_verified_at) values (gen_random_uuid(),'x y','a@b.c',now())`), /permission denied/);
    await assert.rejects(() => db.query<any>(`select public.next_web_order_ref()`), /permission denied/);
    // The only public functions: order tracking by reference + phone, and the catalogue reads (RLS-limited).
    await db.query<any>(`select public.get_public_order_tracking('MBM-ORD-2026-000001','01700000000')`);
    assert.equal((await db.query<any>(`select count(*)::int n from public.web_catalog_products`)).rows[0].n, 0);
  } finally {
    await db.exec("reset role");
  }
});

test("a signed-in customer sees and edits only their own profile; sensitive columns are not editable", async () => {
  const a = (await db.query<any>(`insert into auth.users (email, email_confirmed_at) values ('a@t.test', now()) returning id`)).rows[0].id as string;
  const b = (await db.query<any>(`insert into auth.users (email, email_confirmed_at) values ('b@t.test', now()) returning id`)).rows[0].id as string;
  for (const [id, name] of [[a, "Alice A"], [b, "Bob B"]]) {
    await db.exec(`select set_config('test.uid','${id}',false)`);
    await db.exec("set role authenticated");
    try { await db.query<any>(`select * from public.register_web_customer('${name}', '01711111111')`); } finally { await db.exec("reset role"); }
  }
  await db.exec(`select set_config('test.uid','${a}',false)`);
  await db.exec("set role authenticated");
  try {
    assert.deepEqual((await db.query<any>(`select full_name from public.web_customers`)).rows.map((r: any) => r.full_name), ["Alice A"]);
    await db.query<any>(`update public.web_customers set full_name = 'Alice Updated'`);
    await assert.rejects(() => db.query<any>(`update public.web_customers set erp_customer_id = gen_random_uuid()`), /permission denied/);
    await assert.rejects(() => db.query<any>(`update public.web_customers set email = 'evil@x.y'`), /permission denied/);
    assert.equal((await db.query<any>(`update public.web_customers set full_name = 'Hijack' where full_name = 'Bob B' returning 1`)).rows.length, 0);
  } finally {
    await db.exec("reset role");
  }
  assert.equal((await db.query<any>(`select full_name from public.web_customers where auth_user_id = '${b}'`)).rows[0].full_name, "Bob B");
});

test("service-role-only functions are not executable by the public or by signed-in customers", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      for (const call of ["select public.apply_catalog_event('{}'::jsonb,'x')", "select public.enqueue_order_dispatch('a','b','c')", "select * from public.claim_order_dispatch('w')", "select public.order_dispatch_stats()", "select public.next_web_order_ref()"]) {
        await assert.rejects(() => db.query<any>(call), /permission denied/, `${role} could run: ${call}`);
      }
    } finally {
      await db.exec("reset role");
    }
  }
});

test("rollbacks reverse the chain (106 -> 101) and the chain re-applies", async () => {
  const fresh = await emptyWebsiteDb();
  for (const f of WEBSITE_CHAIN) await fresh.exec(mig(f));
  await assert.rejects(() => fresh.exec(mig("106_customer_tables_rls_rollback.sql")), /Refusing to re-open customer data/);
  await fresh.exec("rollback");
  await fresh.exec(`set app.confirm_reopen_customer_data='yes'; set app.confirm_drop_unsent_orders='yes'; set app.confirm_catalog_projection_drop='yes'; set app.confirm_drop_web_customers='yes';`);
  const order = ["106_customer_tables_rls_rollback.sql", "105_order_dispatch_queue_rollback.sql", "104_catalog_projection_rollback.sql", "103_website_order_inbox_rollback.sql", "101_web_customers_rollback.sql"];
  const failed: string[] = [];
  for (const r of order) {
    try { await fresh.exec(mig(r)); } catch (e) { failed.push(`${r}: ${String((e as Error).message).slice(0, 160)}`); await fresh.exec("rollback").catch(() => undefined); }
  }
  assert.deepEqual(failed, []);
  const left = (await fresh.query<any>(`select table_name from information_schema.tables where table_schema='public' order by 1`)).rows.map((r: any) => r.table_name);
  assert.deepEqual(left, []);
  for (const f of WEBSITE_CHAIN) await fresh.exec(mig(f));
  assert.equal((await fresh.query<any>(`select count(*)::int n from information_schema.tables where table_schema='public' and table_name like 'web_%'`)).rows[0].n > 8, true);
});
