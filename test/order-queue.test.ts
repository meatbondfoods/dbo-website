/**
 * Website -> ERP order reliability on real PostgreSQL (PGlite) with the website's real migration 105:
 * an order is never lost while the ERP is down, retries are byte-identical, nothing is sent twice,
 * and a refused order stops for a person instead of retrying forever.
 */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import type { PGlite } from "@electric-sql/pglite";
import { websiteDb, mig } from "./helpers/pg-fixture.ts";
import { PgDispatchStore, runDispatchOnce, classify } from "../src/lib/order-dispatch.ts";
import { computeHmacSignature, verifyHmacSignature } from "../src/lib/server-hmac.ts";

const SECRET = "queue-test-secret-0123456789abcdef-xyz1";
const ERP_URL = "https://erp.test/api/integrations/web-orders";
const env = { WEB_SYNC_SIGNING_SECRET: SECRET, ERP_INTEGRATION_URL: ERP_URL };
const BURNED = ["meatbond", "secure", "integration", "key", "2026"].join("-");
let db: PGlite;

function pgRpc() {
  return {
    async rpc(fn: string, args: Record<string, unknown> = {}) {
      try {
        await db.exec("set role service_role");
        try {
          const keys = Object.keys(args);
          const r = await db.query(`select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`, keys.map((k) => args[k]));
          if (fn === "claim_order_dispatch") return { data: r.rows, error: null };
          const v = (r.rows[0] as Record<string, unknown> | undefined)?.[r.fields[0].name];
          return { data: v === "" || v === undefined ? null : v, error: null };
        } finally {
          await db.exec("reset role");
        }
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
  };
}
const store = () => new PgDispatchStore(pgRpc());
const q = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, any>[];
const makeDue = () => db.exec("update public.web_order_dispatch set next_attempt_at = now() - interval '1 second' where status in ('pending','retrying')");

/** A fake ERP with scripted statuses. It deduplicates by idempotency key, like the real inbox. */
function erp(script: number[] = []) {
  const calls: { body: string; headers: Record<string, string>; status: number }[] = [];
  const orders = new Map<string, string>();
  let i = 0;
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>;
    const body = String(init.body);
    assert.equal(verifyHmacSignature(body, SECRET, headers["x-meatbond-timestamp"], headers["x-meatbond-signature"]).valid, true, "ERP rejected the signature");
    const status = script[i++] ?? 201;
    calls.push({ body, headers, status });
    if (status === 201 || status === 200) {
      const key = headers["x-meatbond-idempotency-key"];
      const dup = orders.has(key);
      if (!dup) orders.set(key, `erp-${orders.size + 1}`);
      return new Response(JSON.stringify({ success: true, orderId: orders.get(key) }), { status: dup ? 200 : 201 });
    }
    return new Response('{"error":"x"}', { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls, orders };
}
const run = (fetchImpl: typeof fetch, extra: Record<string, unknown> = {}, workerId = "w1") =>
  runDispatchOnce({ store: store(), workerId, fetchImpl, env, ...extra });

before(async () => {
  db = await websiteDb();
});

let n = 0;
const enqueue = async () => {
  const ref = `MBM-ORD-2026-9${String(++n).padStart(5, "0")}`;
  await store().enqueue(ref, `idem-${ref}-0000000000`, JSON.stringify({ orderRef: ref, total: 1000 }));
  return ref;
};

test("classification: refusals stop, outages and config problems retry forever", () => {
  assert.equal(classify(201), "sent");
  assert.equal(classify(200), "sent");
  for (const s of [null, 500, 502, 503, 504, 429, 408, 401, 403]) assert.equal(classify(s), "retry", String(s));
  for (const s of [400, 409, 422]) assert.equal(classify(s), "dead", String(s));
});

test("an order is queued once, however many times it is submitted", async () => {
  const ref = await enqueue();
  await store().enqueue(ref, `idem-${ref}-0000000000`, "{}");
  await store().enqueue("MBM-ORD-2026-OTHER1", `idem-${ref}-0000000000`, "{}");
  assert.equal(Number((await q("select count(*) c from public.web_order_dispatch where idempotency_key = $1", [`idem-${ref}-0000000000`]))[0].c), 1);
  assert.notEqual((await q("select payload_text from public.web_order_dispatch where order_ref=$1", [ref]))[0].payload_text, "{}");
  await run(erp().fetchImpl); // drain
});

test("ERP down: the order is kept, retried with backoff, and delivered exactly once with identical bytes", async () => {
  const ref = await enqueue();
  const e = erp([503, 503, 201]);
  assert.equal((await run(e.fetchImpl)).retrying, 1);
  let row = (await q("select * from public.web_order_dispatch where order_ref=$1", [ref]))[0];
  assert.equal(row.status, "retrying");
  assert.equal(row.attempts, 1);
  assert.equal(row.last_http_status, 503);
  assert.equal((await run(e.fetchImpl)).claimed, 0); // backoff: not due yet
  await makeDue();
  assert.equal((await run(e.fetchImpl)).retrying, 1);
  await makeDue();
  assert.equal((await run(e.fetchImpl)).sent, 1);
  row = (await q("select * from public.web_order_dispatch where order_ref=$1", [ref]))[0];
  assert.equal(row.status, "sent");
  assert.equal(row.attempts, 3);
  assert.ok(row.erp_order_id);
  assert.equal(e.calls.length, 3);
  assert.ok(e.calls.every((c) => c.body === e.calls[0].body)); // byte-identical
  assert.ok(e.calls.every((c) => c.headers["x-meatbond-idempotency-key"] === e.calls[0].headers["x-meatbond-idempotency-key"]));
  assert.equal(e.orders.size, 1);
  assert.equal((await run(e.fetchImpl)).claimed, 0); // a sent order is never sent again
});

test("a crash after the ERP accepted but before we recorded it cannot create a second order", async () => {
  const ref = await enqueue();
  const e = erp();
  const [claimed] = await store().claim("crashed", 5, 60); // a worker takes the order, sends it, then dies
  const ts = Date.now();
  await e.fetchImpl("x", {
    method: "POST",
    body: claimed.payload_text,
    headers: {
      "x-meatbond-idempotency-key": claimed.idempotency_key,
      "x-meatbond-timestamp": String(ts),
      "x-meatbond-signature": computeHmacSignature(claimed.payload_text, SECRET, ts),
    },
  });
  assert.equal(e.orders.size, 1);
  await db.exec(`update public.web_order_dispatch set locked_until = now() - interval '1 second' where order_ref='${ref}'`); // lease expires
  const r = await run(e.fetchImpl, {}, "recovery");
  assert.equal(r.sent, 1);
  assert.equal(e.orders.size, 1); // the ERP saw the same key twice and still holds one order
  assert.equal((await q("select erp_order_id from public.web_order_dispatch where order_ref=$1", [ref]))[0].erp_order_id, "erp-1"); // recorded the SAME ERP order
});

test("two workers never send the same order twice", async () => {
  for (let i = 0; i < 6; i++) await enqueue();
  const e = erp();
  const [a, b] = await Promise.all([run(e.fetchImpl, { batchSize: 3 }, "wA"), run(e.fetchImpl, { batchSize: 3 }, "wB")]);
  assert.equal(a.sent + b.sent, 6);
  const keys = e.calls.map((c) => c.headers["x-meatbond-idempotency-key"]);
  assert.equal(new Set(keys).size, keys.length);
});

test("an order the ERP refuses stops as 'dead' for a person; an operator can requeue it", async () => {
  const ref = await enqueue();
  const e = erp([422, 201]);
  assert.equal((await run(e.fetchImpl)).dead, 1);
  assert.equal((await q("select status from public.web_order_dispatch where order_ref=$1", [ref]))[0].status, "dead");
  await makeDue();
  assert.equal((await run(e.fetchImpl)).claimed, 0); // dead orders are not retried blindly
  const stats = (await pgRpc().rpc("order_dispatch_stats")).data as any;
  assert.equal(stats.dead, 1);
  assert.equal(stats.dead_orders[0].order_ref, ref);
  assert.equal(stats.dead_orders[0].http_status, 422);
  await pgRpc().rpc("requeue_order_dispatch", { p_order_ref: ref });
  assert.equal((await run(e.fetchImpl)).sent, 1);
});

test("missing, burned or half-configured settings: orders are kept untouched until fixed", async () => {
  const ref = await enqueue();
  const e = erp();
  // 1. No secret.
  let r = await run(e.fetchImpl, { env: { ERP_INTEGRATION_URL: ERP_URL } });
  assert.equal(r.unconfigured, 1);
  let row = (await q("select status, attempts, last_error from public.web_order_dispatch where order_ref=$1", [ref]))[0];
  assert.equal(row.attempts, 0); // not counted against the order
  assert.match(row.last_error, /not configured/);
  // 2. The burned secret.
  await makeDue();
  r = await run(e.fetchImpl, { env: { WEB_SYNC_SIGNING_SECRET: BURNED, ERP_INTEGRATION_URL: ERP_URL } });
  assert.equal(r.unconfigured, 1);
  // 3. A secret but no ERP URL: the destination is never guessed.
  await makeDue();
  r = await run(e.fetchImpl, { env: { WEB_SYNC_SIGNING_SECRET: SECRET } });
  assert.equal(r.unconfigured, 1);
  assert.equal(e.calls.length, 0); // nothing was ever sent
  // 4. Fixed: delivered.
  await makeDue();
  assert.equal((await run(e.fetchImpl)).sent, 1);
  row = (await q("select status from public.web_order_dispatch where order_ref=$1", [ref]))[0];
  assert.equal(row.status, "sent");
});

test("grants: only the server can touch the queue; the public cannot read or write it", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await assert.rejects(() => db.query("select * from public.web_order_dispatch"), /permission denied/);
      await assert.rejects(() => db.query("select public.enqueue_order_dispatch('x','y','z')"), /permission denied/);
      await assert.rejects(() => db.query("select * from public.claim_order_dispatch('x')"), /permission denied/);
      await assert.rejects(() => db.query("select public.order_dispatch_stats()"), /permission denied/);
    } finally {
      await db.exec("reset role");
    }
  }
});

test("migration 105 refuses to roll back while orders are unsent, and re-applies cleanly", async () => {
  const fresh = await websiteDb();
  await fresh.query("select public.enqueue_order_dispatch('MBM-ORD-2026-000001','k-1','{}')");
  await assert.rejects(() => fresh.exec(mig("105_order_dispatch_queue_rollback.sql")), /Refusing to drop the order queue/);
  await fresh.exec("rollback");
  await fresh.exec("set app.confirm_drop_unsent_orders = 'yes'");
  await fresh.exec(mig("105_order_dispatch_queue_rollback.sql"));
  assert.equal(((await fresh.query("select to_regclass('public.web_order_dispatch') t")).rows[0] as any).t, null);
  await fresh.exec(mig("105_order_dispatch_queue.sql"));
  assert.notEqual(((await fresh.query("select to_regclass('public.web_order_dispatch') t")).rows[0] as any).t, null);
});
