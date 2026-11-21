-- =====================================================================
-- MIGRATION 103 (WEBSITE SUPABASE): Web Order Inbox & Customer Checkout
-- TARGET: Website Supabase (hiwqrazleuxzrqverbqc)
-- STATUS: DRAFT ONLY - DO NOT EXECUTE AGAINST REMOTE DATABASE
-- Non-destructive, tracked in web_migration_103_registry
-- =====================================================================
BEGIN;

-- 1. Migration Object Registry
CREATE TABLE IF NOT EXISTS public.web_migration_103_registry (
  object_type TEXT NOT NULL,
  object_name TEXT NOT NULL,
  created_by_migration BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (object_type, object_name)
);

-- Helper to register objects
CREATE OR REPLACE FUNCTION public._reg_web_103(p_type TEXT, p_name TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.web_migration_103_registry (object_type, object_name, created_by_migration)
  VALUES (p_type, p_name, TRUE)
  ON CONFLICT (object_type, object_name) DO NOTHING;
END $$;

-- 2. Yearly order reference counter: MBM-ORD-YYYY-XXXXXX
CREATE TABLE IF NOT EXISTS public.web_order_counters (
  year INT PRIMARY KEY,
  last_value BIGINT NOT NULL DEFAULT 0
);
SELECT public._reg_web_103('table', 'web_order_counters');

CREATE OR REPLACE FUNCTION public.next_web_order_ref()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year INT := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Dhaka'))::INT;
  v_n BIGINT;
BEGIN
  INSERT INTO public.web_order_counters (year, last_value)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = public.web_order_counters.last_value + 1
  RETURNING last_value INTO v_n;

  RETURN 'MBM-ORD-' || v_year || '-' || lpad(v_n::TEXT, 6, '0');
END $$;
SELECT public._reg_web_103('function', 'next_web_order_ref()');

-- 3. Web Orders Inbox
CREATE TABLE IF NOT EXISTS public.web_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref         TEXT NOT NULL UNIQUE,
  web_customer_id   UUID REFERENCES public.web_customers(id) ON DELETE SET NULL,
  idempotency_key   TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 100),
  request_hash      TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending_confirmation'
                    CHECK (status IN ('pending_confirmation', 'accepted', 'on_hold', 'rejected', 'cancelled')),
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('cod', 'bkash', 'nagad', 'card')),
  payment_status    TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  delivery_name     TEXT NOT NULL,
  delivery_phone    TEXT NOT NULL,
  delivery_line1    TEXT NOT NULL,
  delivery_area     TEXT NOT NULL,
  delivery_city     TEXT NOT NULL DEFAULT 'Dhaka',
  delivery_notes    TEXT,
  subtotal          NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  delivery_charge   NUMERIC(14,2) NOT NULL CHECK (delivery_charge >= 0),
  delivery_status   TEXT NOT NULL DEFAULT 'to_be_confirmed' CHECK (delivery_status IN ('calculated', 'to_be_confirmed')),
  total             NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  erp_sync_status   TEXT NOT NULL DEFAULT 'pending' CHECK (erp_sync_status IN ('pending', 'synced', 'failed')),
  erp_synced_at     TIMESTAMPTZ,
  erp_sync_error    TEXT,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT public._reg_web_103('table', 'web_orders');

CREATE UNIQUE INDEX IF NOT EXISTS idx_web_orders_idempotency_key
  ON public.web_orders (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_web_orders_status ON public.web_orders (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_orders_phone ON public.web_orders (delivery_phone);
CREATE INDEX IF NOT EXISTS idx_web_orders_customer ON public.web_orders (web_customer_id);

-- 4. Web Order Items
CREATE TABLE IF NOT EXISTS public.web_order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_order_id  UUID NOT NULL REFERENCES public.web_orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL,
  product_name  TEXT NOT NULL,
  unit          TEXT NOT NULL DEFAULT 'kg',
  quantity      NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  weight_grams  NUMERIC(10,2),
  option_label  TEXT,
  line_total    NUMERIC(14,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED
);
SELECT public._reg_web_103('table', 'web_order_items');
CREATE INDEX IF NOT EXISTS idx_web_order_items_order ON public.web_order_items (web_order_id);

-- 5. Web Order Events (Append-only Audit Log)
CREATE TABLE IF NOT EXISTS public.web_order_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_order_id  UUID NOT NULL REFERENCES public.web_orders(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN ('submitted', 'accepted', 'rejected', 'cancelled', 'on_hold', 'note', 'sync_dispatched')),
  customer_note TEXT,
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('customer', 'system', 'admin')),
  actor_id      UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
SELECT public._reg_web_103('table', 'web_order_events');

CREATE OR REPLACE FUNCTION public.web_order_events_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'web_order_events table is append-only.';
END $$;
SELECT public._reg_web_103('function', 'web_order_events_append_only()');

DROP TRIGGER IF EXISTS trg_web_order_events_ao ON public.web_order_events;
CREATE TRIGGER trg_web_order_events_ao
  BEFORE UPDATE OR DELETE ON public.web_order_events
  FOR EACH ROW EXECUTE FUNCTION public.web_order_events_append_only();
SELECT public._reg_web_103('trigger', 'trg_web_order_events_ao');

-- 6. Public Order Tracking RPC (Safe lookup by reference + normalized phone)
CREATE OR REPLACE FUNCTION public.get_public_order_tracking(p_ref TEXT, p_phone TEXT)
RETURNS TABLE (
  order_ref TEXT,
  status TEXT,
  submitted_at TIMESTAMPTZ,
  subtotal NUMERIC,
  delivery_charge NUMERIC,
  delivery_status TEXT,
  total NUMERIC,
  payment_method TEXT,
  payment_status TEXT,
  items JSONB
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    o.order_ref,
    o.status,
    o.submitted_at,
    o.subtotal,
    o.delivery_charge,
    o.delivery_status,
    o.total,
    o.payment_method,
    o.payment_status,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'product_id', i.product_id,
        'name', i.product_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'weight_grams', i.weight_grams,
        'option_label', i.option_label,
        'line_total', i.line_total
      )) FROM public.web_order_items i WHERE i.web_order_id = o.id),
      '[]'::jsonb
    ) AS items
  FROM public.web_orders o
  WHERE o.order_ref = trim(p_ref)
    AND (
      o.delivery_phone = trim(p_phone)
      OR o.delivery_phone = regexp_replace(trim(p_phone), '^(\+?88)?', '+88')
    )
  LIMIT 1;
$$;
SELECT public._reg_web_103('function', 'get_public_order_tracking(text,text)');

REVOKE ALL ON FUNCTION public.get_public_order_tracking(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_tracking(TEXT, TEXT) TO anon, authenticated, service_role;

-- 7. Authenticated Customer Tracking RPC
CREATE OR REPLACE FUNCTION public.get_my_web_orders()
RETURNS TABLE (
  order_ref TEXT,
  status TEXT,
  submitted_at TIMESTAMPTZ,
  subtotal NUMERIC,
  delivery_charge NUMERIC,
  delivery_status TEXT,
  total NUMERIC,
  payment_method TEXT,
  payment_status TEXT,
  items JSONB,
  events JSONB
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth AS $$
  SELECT
    o.order_ref,
    o.status,
    o.submitted_at,
    o.subtotal,
    o.delivery_charge,
    o.delivery_status,
    o.total,
    o.payment_method,
    o.payment_status,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'product_id', i.product_id,
        'name', i.product_name,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'weight_grams', i.weight_grams,
        'option_label', i.option_label,
        'line_total', i.line_total
      )) FROM public.web_order_items i WHERE i.web_order_id = o.id),
      '[]'::jsonb
    ) AS items,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'event_type', e.event_type,
        'note', e.customer_note,
        'created_at', e.created_at
      ) ORDER BY e.created_at) FROM public.web_order_events e WHERE e.web_order_id = o.id),
      '[]'::jsonb
    ) AS events
  FROM public.web_orders o
  JOIN public.web_customers c ON c.id = o.web_customer_id
  WHERE c.auth_user_id = auth.uid()
  ORDER BY o.submitted_at DESC;
$$;
SELECT public._reg_web_103('function', 'get_my_web_orders()');

REVOKE ALL ON FUNCTION public.get_my_web_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_web_orders() TO authenticated, service_role;

-- 8. Row Level Security Policies
ALTER TABLE public.web_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_order_events ENABLE ROW LEVEL SECURITY;

-- Authenticated customers can view only their own orders
DROP POLICY IF EXISTS web_orders_cust_select ON public.web_orders;
CREATE POLICY web_orders_cust_select ON public.web_orders
  FOR SELECT TO authenticated
  USING (
    web_customer_id IN (
      SELECT id FROM public.web_customers WHERE auth_user_id = auth.uid()
    )
  );
SELECT public._reg_web_103('policy', 'web_orders_cust_select ON web_orders');

DROP POLICY IF EXISTS web_order_items_cust_select ON public.web_order_items;
CREATE POLICY web_order_items_cust_select ON public.web_order_items
  FOR SELECT TO authenticated
  USING (
    web_order_id IN (
      SELECT o.id FROM public.web_orders o
      JOIN public.web_customers c ON c.id = o.web_customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );
SELECT public._reg_web_103('policy', 'web_order_items_cust_select ON web_order_items');

DROP POLICY IF EXISTS web_order_events_cust_select ON public.web_order_events;
CREATE POLICY web_order_events_cust_select ON public.web_order_events
  FOR SELECT TO authenticated
  USING (
    web_order_id IN (
      SELECT o.id FROM public.web_orders o
      JOIN public.web_customers c ON c.id = o.web_customer_id
      WHERE c.auth_user_id = auth.uid()
    )
  );
SELECT public._reg_web_103('policy', 'web_order_events_cust_select ON web_order_events');

-- Service role has full administrative access
DROP POLICY IF EXISTS web_orders_service_all ON public.web_orders;
CREATE POLICY web_orders_service_all ON public.web_orders
  FOR ALL TO service_role USING (true) WITH CHECK (true);
SELECT public._reg_web_103('policy', 'web_orders_service_all ON web_orders');

DROP POLICY IF EXISTS web_order_items_service_all ON public.web_order_items;
CREATE POLICY web_order_items_service_all ON public.web_order_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);
SELECT public._reg_web_103('policy', 'web_order_items_service_all ON web_order_items');

DROP POLICY IF EXISTS web_order_events_service_all ON public.web_order_events;
CREATE POLICY web_order_events_service_all ON public.web_order_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);
SELECT public._reg_web_103('policy', 'web_order_events_service_all ON web_order_events');

-- Drop registration helper
DROP FUNCTION IF EXISTS public._reg_web_103(TEXT, TEXT);

COMMIT;
