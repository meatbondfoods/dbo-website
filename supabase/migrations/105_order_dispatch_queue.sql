-- =====================================================================
-- MIGRATION 105 (WEBSITE SUPABASE): durable queue for sending orders to the ERP
-- TARGET: the Website Supabase project (never the ERP project).
-- STATUS: not applied anywhere. Apply to a verified development project first.
--
-- A customer's order is stored on the website first. Sending it to the ERP then happens through
-- this queue, so an ERP outage, a deploy or a crash never loses an order:
--   * the exact request body is stored once, so every retry is byte-identical
--   * the order reference / idempotency key is the unique key: an order is queued at most once
--   * the ERP deduplicates by the same idempotency key, so a retry can never create a second order
--   * 5xx, 429, timeouts, network errors, 401/403 (secret mismatch): retried forever with backoff
--     (capped at 6 hours), because they are not the order's fault
--   * any other 4xx: the ERP refused the order itself -> 'dead' (needs a person), never retried blindly
-- Statuses: pending | processing | retrying | sent | dead
-- Rollback: supabase/migrations/105_order_dispatch_queue_rollback.sql
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.web_order_dispatch (
  order_ref        TEXT PRIMARY KEY,
  idempotency_key  TEXT NOT NULL UNIQUE,
  payload_text     TEXT NOT NULL,                  -- the exact body sent to the ERP
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'retrying', 'sent', 'dead')),
  attempts         INT NOT NULL DEFAULT 0,
  next_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until     TIMESTAMPTZ,
  locked_by        TEXT,
  last_http_status INT,
  last_error       TEXT,
  erp_order_id     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_web_order_dispatch_due ON public.web_order_dispatch (status, next_attempt_at);

ALTER TABLE public.web_order_dispatch ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_order_dispatch FROM PUBLIC, anon, authenticated;   -- service_role only

-- Queue an order. Safe to call twice: the second call changes nothing.
CREATE OR REPLACE FUNCTION public.enqueue_order_dispatch(p_order_ref TEXT, p_idempotency_key TEXT, p_payload_text TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.web_order_dispatch (order_ref, idempotency_key, payload_text)
  VALUES (p_order_ref, p_idempotency_key, p_payload_text)
  ON CONFLICT DO NOTHING;
$$;

-- Hand a batch of due orders to a worker. SKIP LOCKED: two workers never get the same order;
-- a lease that expires (crashed worker) makes the order claimable again.
CREATE OR REPLACE FUNCTION public.claim_order_dispatch(p_worker TEXT, p_limit INT DEFAULT 10, p_lease_seconds INT DEFAULT 60)
RETURNS SETOF public.web_order_dispatch
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH due AS (
    SELECT d.order_ref
      FROM public.web_order_dispatch d
     WHERE (d.status IN ('pending', 'retrying') AND d.next_attempt_at <= now())
        OR (d.status = 'processing' AND d.locked_until < now())
     ORDER BY d.next_attempt_at, d.created_at
     LIMIT GREATEST(p_limit, 1)
       FOR UPDATE SKIP LOCKED
  )
  UPDATE public.web_order_dispatch d
     SET status = 'processing', locked_by = p_worker,
         locked_until = now() + make_interval(secs => p_lease_seconds), updated_at = now()
    FROM due
   WHERE d.order_ref = due.order_ref
  RETURNING d.*;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_dispatch_sent(p_order_ref TEXT, p_http_status INT, p_erp_order_id TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.web_order_dispatch
     SET status = 'sent', attempts = attempts + 1, last_http_status = p_http_status, last_error = NULL,
         erp_order_id = p_erp_order_id, sent_at = now(), locked_by = NULL, locked_until = NULL, updated_at = now()
   WHERE order_ref = p_order_ref;
$$;

-- p_kind 'retry' (the ERP is unavailable or misconfigured: try again later, never give up) or
-- 'dead' (the ERP refused this order: a person must look at it).
CREATE OR REPLACE FUNCTION public.mark_order_dispatch_failed(p_order_ref TEXT, p_kind TEXT, p_http_status INT, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delays CONSTANT INT[] := ARRAY[30, 120, 600, 3600, 21600];
  v_attempt INT;
BEGIN
  IF p_kind NOT IN ('retry', 'dead') THEN RAISE EXCEPTION 'Unknown failure kind: %', p_kind; END IF;
  UPDATE public.web_order_dispatch
     SET attempts = attempts + 1, last_http_status = p_http_status, last_error = left(p_error, 500),
         locked_by = NULL, locked_until = NULL, updated_at = now()
   WHERE order_ref = p_order_ref
   RETURNING attempts INTO v_attempt;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not queued: %', p_order_ref; END IF;

  IF p_kind = 'dead' THEN
    UPDATE public.web_order_dispatch SET status = 'dead' WHERE order_ref = p_order_ref;
  ELSE
    UPDATE public.web_order_dispatch
       SET status = 'retrying',
           next_attempt_at = now() + make_interval(secs => v_delays[LEAST(v_attempt, array_length(v_delays, 1))] * (0.9 + random() * 0.2))
     WHERE order_ref = p_order_ref;
  END IF;
END;
$$;

-- Give an order back without counting an attempt (e.g. the secret is not configured yet).
CREATE OR REPLACE FUNCTION public.release_order_dispatch(p_order_ref TEXT, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.web_order_dispatch
     SET status = 'retrying', locked_by = NULL, locked_until = NULL, last_error = left(p_note, 500),
         next_attempt_at = now() + interval '1 minute', updated_at = now()
   WHERE order_ref = p_order_ref AND status = 'processing';
$$;

-- An operator puts a dead order back in the queue after fixing the cause.
CREATE OR REPLACE FUNCTION public.requeue_order_dispatch(p_order_ref TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.web_order_dispatch
     SET status = 'pending', next_attempt_at = now(), updated_at = now()
   WHERE order_ref = p_order_ref AND status = 'dead';
$$;

CREATE OR REPLACE FUNCTION public.order_dispatch_stats()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT jsonb_build_object(
    'pending',    count(*) FILTER (WHERE status = 'pending'),
    'processing', count(*) FILTER (WHERE status = 'processing'),
    'retrying',   count(*) FILTER (WHERE status = 'retrying'),
    'sent',       count(*) FILTER (WHERE status = 'sent'),
    'dead',       count(*) FILTER (WHERE status = 'dead'),
    'oldest_unsent_age_seconds', extract(epoch FROM now() - min(created_at) FILTER (WHERE status <> 'sent'))::BIGINT,
    'dead_orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('order_ref', order_ref, 'http_status', last_http_status, 'error', last_error))
                             FROM public.web_order_dispatch WHERE status = 'dead'), '[]'::JSONB)
  ) FROM public.web_order_dispatch;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'enqueue_order_dispatch(text,text,text)', 'claim_order_dispatch(text,int,int)', 'mark_order_dispatch_sent(text,int,text)',
    'mark_order_dispatch_failed(text,text,int,text)', 'release_order_dispatch(text,text)', 'requeue_order_dispatch(text)',
    'order_dispatch_stats()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', f);
  END LOOP;
END $$;

COMMIT;
