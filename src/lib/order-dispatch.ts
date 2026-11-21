import { computeHmacSignature } from "./server-hmac.ts";
import { loadSigningKeys, SyncConfigError } from "./sync-config.ts";

/**
 * Durable delivery of website orders to the ERP.
 *
 * An order is queued once (keyed by its order reference and idempotency key) with the exact request
 * body. Workers then send it, retrying forever with backoff while the ERP is unavailable, so an
 * outage or a crash never loses an order. The ERP deduplicates by the same idempotency key, so a
 * retry can never create a second order.
 */

export interface DispatchRow {
  order_ref: string;
  idempotency_key: string;
  payload_text: string;
  attempts: number;
}

export interface DispatchStore {
  enqueue(orderRef: string, idempotencyKey: string, payloadText: string): Promise<void>;
  claim(worker: string, limit: number, leaseSeconds: number): Promise<DispatchRow[]>;
  markSent(orderRef: string, httpStatus: number, erpOrderId: string | null): Promise<void>;
  markFailed(orderRef: string, kind: "retry" | "dead", httpStatus: number | null, error: string): Promise<void>;
  release(orderRef: string, note: string): Promise<void>;
}

export type Outcome = "sent" | "retry" | "dead";

/** 2xx: delivered. 401/403 (secret mismatch), 408/425/429, 5xx and no response: the order is fine, try later. Other 4xx: the ERP refused it. */
export function classify(status: number | null): Outcome {
  if (status === null) return "retry";
  if (status >= 200 && status < 300) return "sent";
  if (status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500) return "retry";
  return "dead";
}

export interface DispatchDeps {
  store: DispatchStore;
  workerId: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: () => number;
  batchSize?: number;
  leaseSeconds?: number;
  timeoutMs?: number;
}

export interface DispatchResult {
  claimed: number;
  sent: number;
  retrying: number;
  dead: number;
  /** Orders put back untouched because the integration is not configured. */
  unconfigured: number;
}

function erpUrlFrom(env: Record<string, string | undefined>): string | null {
  const raw = env.ERP_INTEGRATION_URL?.trim();
  if (!raw) return null;               // no default URL: a missing setting must never send orders somewhere guessed
  try {
    const u = new URL(raw);
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && env.NODE_ENV !== "production")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Claims due orders and tries to deliver each one. Safe to run from several workers at once. */
export async function runDispatchOnce(deps: DispatchDeps): Promise<DispatchResult> {
  const env = deps.env ?? process.env;
  const doFetch = deps.fetchImpl ?? fetch;
  const clock = deps.now ?? Date.now;
  const result: DispatchResult = { claimed: 0, sent: 0, retrying: 0, dead: 0, unconfigured: 0 };

  const batch = await deps.store.claim(deps.workerId, deps.batchSize ?? 10, deps.leaseSeconds ?? 60);
  result.claimed = batch.length;
  if (batch.length === 0) return result;

  let key;
  let url: string | null = null;
  try {
    key = loadSigningKeys(env)[0];
    url = erpUrlFrom(env);
  } catch (err) {
    if (!(err instanceof SyncConfigError)) throw err;
    console.error("[order-dispatch] integration secret misconfigured:", err.message);
  }

  for (const row of batch) {
    if (!key || !url) {
      // Not the order's fault: put it back without counting an attempt, so it is not lost or killed.
      await deps.store.release(row.order_ref, "ERP integration is not configured on the website");
      result.unconfigured += 1;
      continue;
    }
    const ts = clock();
    let status: number | null = null;
    let error = "";
    let erpOrderId: string | null = null;
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-meatbond-signature": computeHmacSignature(row.payload_text, key.secret, ts),
          "x-meatbond-timestamp": String(ts),
          "x-meatbond-key-id": key.keyId,
          "x-meatbond-idempotency-key": row.idempotency_key,
        },
        body: row.payload_text,
        signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
      });
      status = res.status;
      const text = await res.text().catch(() => "");
      if (res.ok) {
        try { erpOrderId = (JSON.parse(text) as { orderId?: string }).orderId ?? null; } catch { /* not JSON */ }
      } else {
        error = text.slice(0, 200);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const outcome = classify(status);
    if (outcome === "sent") {
      await deps.store.markSent(row.order_ref, status as number, erpOrderId);
      result.sent += 1;
    } else if (outcome === "dead") {
      await deps.store.markFailed(row.order_ref, "dead", status, error || `ERP refused the order (HTTP ${status})`);
      result.dead += 1;
    } else {
      await deps.store.markFailed(row.order_ref, "retry", status, error || `ERP unavailable (HTTP ${status ?? "no response"})`);
      result.retrying += 1;
    }
  }
  return result;
}

// ── Postgres store (production) ─────────────────────────────────────────────
interface RpcClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

export class PgDispatchStore implements DispatchStore {
  private readonly client: RpcClient;
  constructor(client: RpcClient) { this.client = client; }

  private async call(fn: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new Error(`${fn} failed: ${error.message}`);
    return data;
  }
  async enqueue(orderRef: string, idempotencyKey: string, payloadText: string) {
    await this.call("enqueue_order_dispatch", { p_order_ref: orderRef, p_idempotency_key: idempotencyKey, p_payload_text: payloadText });
  }
  async claim(worker: string, limit: number, leaseSeconds: number) {
    return ((await this.call("claim_order_dispatch", { p_worker: worker, p_limit: limit, p_lease_seconds: leaseSeconds })) as DispatchRow[] | null) ?? [];
  }
  async markSent(orderRef: string, httpStatus: number, erpOrderId: string | null) {
    await this.call("mark_order_dispatch_sent", { p_order_ref: orderRef, p_http_status: httpStatus, p_erp_order_id: erpOrderId });
  }
  async markFailed(orderRef: string, kind: "retry" | "dead", httpStatus: number | null, error: string) {
    await this.call("mark_order_dispatch_failed", { p_order_ref: orderRef, p_kind: kind, p_http_status: httpStatus, p_error: error });
  }
  async release(orderRef: string, note: string) {
    await this.call("release_order_dispatch", { p_order_ref: orderRef, p_note: note });
  }
}

// ── In-memory store (development and tests ONLY; not durable) ────────────────
export class MemoryDispatchStore implements DispatchStore {
  readonly rows = new Map<string, DispatchRow & { status: string; last_error?: string; http?: number | null }>();

  async enqueue(orderRef: string, idempotencyKey: string, payloadText: string) {
    if (!this.rows.has(orderRef)) this.rows.set(orderRef, { order_ref: orderRef, idempotency_key: idempotencyKey, payload_text: payloadText, attempts: 0, status: "pending" });
  }
  async claim(_worker: string, limit: number) {
    const due = [...this.rows.values()].filter((r) => r.status === "pending" || r.status === "retrying").slice(0, limit);
    for (const r of due) r.status = "processing";
    return due.map((r) => ({ ...r }));
  }
  async markSent(orderRef: string, httpStatus: number) {
    const r = this.rows.get(orderRef); if (r) { r.status = "sent"; r.attempts++; r.http = httpStatus; }
  }
  async markFailed(orderRef: string, kind: "retry" | "dead", httpStatus: number | null, error: string) {
    const r = this.rows.get(orderRef); if (r) { r.status = kind === "dead" ? "dead" : "retrying"; r.attempts++; r.last_error = error; r.http = httpStatus; }
  }
  async release(orderRef: string, note: string) {
    const r = this.rows.get(orderRef); if (r) { r.status = "retrying"; r.last_error = note; }
  }
}
