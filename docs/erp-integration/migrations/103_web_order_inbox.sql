-- =====================================================================
-- PROPOSED MIGRATION 103: ERP order inbox, order submission, ERP conversion
-- STATUS: FOR REVIEW ONLY. NOT APPLIED. Depends on 101 and 102 (product_display, site_content). Apply to a verified DEV database first.
-- Website orders NEVER insert into sales_orders directly. They land here as
-- 'pending_confirmation'. ERP staff convert them into DRAFT sales orders; the ERP's own
-- approval triggers (trg_workflow_sales_orders) then govern confirmation.
-- Part A is website-facing. Part B (marked ERP-SIDE) adds functions staff use and needs ERP approval.
-- =====================================================================
BEGIN;

-- ---- Yearly order-reference counter: MBM-ORD-2026-000001 (atomic, never reused) ------
CREATE TABLE IF NOT EXISTS public.web_order_counters (year INT PRIMARY KEY, last_value BIGINT NOT NULL DEFAULT 0);

CREATE OR REPLACE FUNCTION public.next_web_order_ref()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE v_year INT := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Dhaka'))::INT; v_n BIGINT;
BEGIN
  INSERT INTO web_order_counters (year, last_value) VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = web_order_counters.last_value + 1
  RETURNING last_value INTO v_n;
  RETURN 'MBM-ORD-' || v_year || '-' || lpad(v_n::TEXT, 6, '0');
END $$;

-- ---- PRICE SOURCE STUB ----------------------------------------------------------------
-- The ERP has NO persisted selling price (see 01-findings.md). Until the owner approves
-- option A or B, this raises so no order can be created with an invented price.
-- Replace the body once the ERP price source exists. Callers never pass a price.
CREATE OR REPLACE FUNCTION public.web_current_price(p_product_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
BEGIN
  RAISE EXCEPTION 'ERP selling-price source is not configured. Orders are disabled until it is approved.';
END $$;

-- Same lookup, but NULL instead of an error, for catalogue listing (hides unpriced products).
CREATE OR REPLACE FUNCTION public.web_price_or_null(p_product_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
BEGIN RETURN public.web_current_price(p_product_id); EXCEPTION WHEN OTHERS THEN RETURN NULL; END $$;

-- ---- Inbox tables ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref         TEXT NOT NULL UNIQUE,
  web_customer_id   UUID NOT NULL REFERENCES public.web_customers(id),
  idempotency_key   TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 100),
  request_hash      TEXT NOT NULL,                       -- detects key reuse with a different payload
  status            TEXT NOT NULL DEFAULT 'pending_confirmation'
                    CHECK (status IN ('pending_confirmation', 'accepted', 'on_hold', 'rejected', 'cancelled_by_customer')),
  -- NOTE: the ERP sales_order_status enum has no 'on_hold'. "On hold" therefore lives on the inbox record and is set by
  -- ERP staff before conversion. Mapping to real ERP statuses is finalised in the ERP integration phase.
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('cod', 'bkash', 'nagad', 'card')),
  payment_status    TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'failed', 'refunded')),
  delivery_name     TEXT NOT NULL,
  delivery_phone    TEXT NOT NULL,
  delivery_line1    TEXT NOT NULL,
  delivery_area     TEXT NOT NULL,
  delivery_city     TEXT NOT NULL,
  delivery_notes    TEXT,
  subtotal          NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  delivery_charge   NUMERIC(14,2) NOT NULL CHECK (delivery_charge >= 0),
  delivery_status   TEXT NOT NULL DEFAULT 'to_be_confirmed' CHECK (delivery_status IN ('calculated', 'to_be_confirmed')),
  total             NUMERIC(14,2) NOT NULL CHECK (total >= 0),
  erp_sales_order_id UUID UNIQUE REFERENCES public.sales_orders(id),   -- set on conversion
  rejection_reason  TEXT,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (web_customer_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_web_orders_status ON public.web_orders (status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.web_order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_order_id  UUID NOT NULL REFERENCES public.web_orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES public.products(id),
  product_name  TEXT NOT NULL,                              -- snapshot for the timeline/receipt
  unit          TEXT NOT NULL,
  quantity      NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),  -- ERP price verified at submission
  line_total    NUMERIC(14,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED
);

-- Append-only timeline shown to the customer.
CREATE TABLE IF NOT EXISTS public.web_order_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_order_id  UUID NOT NULL REFERENCES public.web_orders(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,           -- submitted | accepted | rejected | cancelled | note
  customer_note TEXT,                    -- the only free text a customer ever sees
  actor_type    TEXT NOT NULL CHECK (actor_type IN ('customer', 'erp_staff', 'system')),
  actor_id      UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.web_order_events_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'web_order_events is append-only.'; END $$;
DROP TRIGGER IF EXISTS trg_web_order_events_ao ON public.web_order_events;
CREATE TRIGGER trg_web_order_events_ao BEFORE UPDATE OR DELETE ON public.web_order_events
  FOR EACH ROW EXECUTE FUNCTION public.web_order_events_append_only();

-- =====================================================================
-- PART A (website-facing): submit an order with the CUSTOMER'S OWN session. No service role.
-- p_lines: [{"product_id": "<uuid>", "quantity": 2}]  -- no prices are ever accepted from the client.
-- Stock is only CHECKED here. Nothing is deducted or reserved until ERP confirms.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.place_web_order(
  p_idempotency_key TEXT, p_delivery JSONB, p_payment_method TEXT, p_lines JSONB
) RETURNS TABLE (order_ref TEXT, status TEXT, subtotal NUMERIC, delivery_charge NUMERIC, total NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
#variable_conflict use_column
DECLARE
  v_cust public.web_customers; v_hash TEXT; v_existing public.web_orders; v_order UUID; v_ref TEXT;
  v_line JSONB; v_qty NUMERIC; v_price NUMERIC; v_avail NUMERIC; v_prod public.products;
  v_sub NUMERIC := 0; v_charge NUMERIC; v_free NUMERIC; v_fee NUMERIC; v_active BOOLEAN;
BEGIN
  SELECT * INTO v_cust FROM web_customers WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Sign in with a verified website customer account to order.'; END IF;
  IF p_payment_method NOT IN ('cod') THEN
    -- Only methods the business has actually configured may be accepted. Online gateways are not configured.
    RAISE EXCEPTION 'Payment method % is not enabled.', p_payment_method;
  END IF;
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 1 AND 40 THEN RAISE EXCEPTION 'Invalid order lines.'; END IF;

  v_hash := md5(COALESCE(p_delivery::TEXT, '') || p_payment_method || p_lines::TEXT);
  SELECT * INTO v_existing FROM web_orders WHERE web_customer_id = v_cust.id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.request_hash <> v_hash THEN RAISE EXCEPTION 'Idempotency key was already used for a different order.'; END IF;
    RETURN QUERY SELECT v_existing.order_ref, v_existing.status, v_existing.subtotal, v_existing.delivery_charge, v_existing.total;
    RETURN;
  END IF;

  v_ref := next_web_order_ref();
  INSERT INTO web_orders (order_ref, web_customer_id, idempotency_key, request_hash, payment_method,
      delivery_name, delivery_phone, delivery_line1, delivery_area, delivery_city, delivery_notes,
      subtotal, delivery_charge, total)
  VALUES (v_ref, v_cust.id, p_idempotency_key, v_hash, p_payment_method,
      COALESCE(NULLIF(p_delivery ->> 'full_name', ''), v_cust.full_name), COALESCE(normalize_bd_phone(p_delivery ->> 'phone'), v_cust.phone), p_delivery ->> 'line1', p_delivery ->> 'area', COALESCE(p_delivery ->> 'city', 'Dhaka'), p_delivery ->> 'notes',
      0, 0, 0)
  RETURNING id INTO v_order;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty := (v_line ->> 'quantity')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty > 500 THEN RAISE EXCEPTION 'Invalid quantity.'; END IF;
    SELECT * INTO v_prod FROM products WHERE id = (v_line ->> 'product_id')::UUID AND is_active
       AND EXISTS (SELECT 1 FROM product_display d WHERE d.product_id = products.id AND d.visible);
    IF NOT FOUND THEN RAISE EXCEPTION 'A product in your order is unavailable.'; END IF;
    v_price := web_current_price(v_prod.id);                         -- ERP price; raises until configured
    SELECT COALESCE(quantity_available, 0) INTO v_avail FROM inventory_levels WHERE product_id = v_prod.id;
    IF COALESCE(v_avail, 0) < v_qty THEN RAISE EXCEPTION 'Not enough stock for %.', v_prod.name; END IF;
    INSERT INTO web_order_items (web_order_id, product_id, product_name, unit, quantity, unit_price)
    VALUES (v_order, v_prod.id, v_prod.name, v_prod.unit, v_qty, v_price);
    v_sub := v_sub + round(v_qty * v_price, 2);
  END LOOP;

  -- Delivery policy is NOT approved. Unless an owner has published commerce.active = true, NO charge is applied and the
  -- order is marked delivery_status = 'to_be_confirmed' (the team confirms it). No default fee or radius is assumed.
  SELECT (data ->> 'active')::BOOLEAN, (data ->> 'chargeBeyond')::NUMERIC, (data ->> 'freeOverAmount')::NUMERIC
    INTO v_active, v_fee, v_free FROM site_content WHERE key = 'commerce' AND status = 'published';
  IF COALESCE(v_active, FALSE) THEN
    v_charge := CASE WHEN COALESCE(v_free, 0) > 0 AND v_sub >= v_free THEN 0 ELSE COALESCE(v_fee, 0) END;
    -- (distance-based free radius is evaluated against the chosen area once the policy is approved and the area list exists)
  ELSE
    v_charge := 0;
  END IF;

  UPDATE web_orders SET subtotal = v_sub, delivery_charge = v_charge, total = v_sub + v_charge,
         delivery_status = CASE WHEN COALESCE(v_active, FALSE) THEN 'calculated' ELSE 'to_be_confirmed' END
   WHERE id = v_order;
  INSERT INTO web_order_events (web_order_id, event_type, customer_note, actor_type, actor_id)
  VALUES (v_order, 'submitted', 'Order received. Awaiting confirmation.', 'customer', auth.uid());

  RETURN QUERY SELECT v_ref, 'pending_confirmation'::TEXT, v_sub, v_charge, v_sub + v_charge;
END $$;

REVOKE ALL ON FUNCTION public.place_web_order(TEXT, JSONB, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_web_order(TEXT, JSONB, TEXT, JSONB) TO authenticated;

-- Customer tracking: own orders only, limited columns, status mirrored from the ERP once converted.
CREATE OR REPLACE FUNCTION public.get_my_web_orders()
RETURNS TABLE (order_ref TEXT, display_status TEXT, submitted_at TIMESTAMPTZ, subtotal NUMERIC, delivery_charge NUMERIC, delivery_status TEXT, total NUMERIC, payment_method TEXT, payment_status TEXT, items JSONB, timeline JSONB)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, auth AS $$
  SELECT o.order_ref,
         CASE o.status
           WHEN 'pending_confirmation' THEN 'pending_confirmation'
           WHEN 'on_hold' THEN 'on_hold'
           WHEN 'rejected' THEN 'rejected'
           WHEN 'cancelled_by_customer' THEN 'cancelled'
           ELSE CASE WHEN so.status::TEXT = 'draft' THEN 'pending_confirmation' ELSE COALESCE(so.status::TEXT, 'pending_confirmation') END
         END,
         o.submitted_at, o.subtotal, o.delivery_charge, o.delivery_status, o.total, o.payment_method, o.payment_status,
         (SELECT jsonb_agg(jsonb_build_object('product_id', i.product_id, 'name', i.product_name, 'unit', i.unit, 'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total)) FROM web_order_items i WHERE i.web_order_id = o.id),
         (SELECT jsonb_agg(jsonb_build_object('type', e.event_type, 'note', e.customer_note, 'at', e.created_at) ORDER BY e.created_at) FROM web_order_events e WHERE e.web_order_id = o.id)
  FROM web_orders o
  JOIN web_customers c ON c.id = o.web_customer_id AND c.auth_user_id = auth.uid()
  LEFT JOIN sales_orders so ON so.id = o.erp_sales_order_id          -- read-only status mirror
  ORDER BY o.submitted_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_web_orders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_web_orders() TO authenticated;

-- =====================================================================
-- PART B (ERP-SIDE, needs ERP owner approval): staff convert or reject inbox orders.
-- Uses the ERP's existing require_permission(); creates a DRAFT sales order only, so the
-- existing approval workflow (trg_workflow_sales_orders) still governs confirmation.
-- ASSUMPTION TO VERIFY: sales_orders.order_number convention. Here the web reference is reused.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.convert_web_order(p_web_order UUID, p_erp_customer UUID DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_o public.web_orders; v_c public.web_customers; v_cust UUID; v_so UUID;
BEGIN
  PERFORM public.require_permission('sales', 'create');
  SELECT * INTO v_o FROM web_orders WHERE id = p_web_order FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Web order not found.'; END IF;
  IF v_o.status NOT IN ('pending_confirmation', 'on_hold') THEN RAISE EXCEPTION 'Order is already %.', v_o.status; END IF;
  SELECT * INTO v_c FROM web_customers WHERE id = v_o.web_customer_id;

  v_cust := COALESCE(p_erp_customer, v_c.erp_customer_id);
  IF v_cust IS NULL THEN RAISE EXCEPTION 'Link or create the ERP customer first (website customer %, email %).', v_c.customer_code, v_c.email; END IF;
  IF p_erp_customer IS NOT NULL AND v_c.erp_customer_id IS DISTINCT FROM p_erp_customer THEN
    UPDATE web_customers SET erp_customer_id = p_erp_customer, erp_match_status = 'linked_by_staff' WHERE id = v_c.id;
  END IF;

  INSERT INTO sales_orders (order_number, customer_id, status, subtotal, discount, tax, total_amount, notes, created_by)
  VALUES (v_o.order_ref, v_cust, 'draft', v_o.subtotal, 0, 0, v_o.total,
          'Website order ' || v_o.order_ref || ' | payment: ' || v_o.payment_method || ' | delivery charge: ' || v_o.delivery_charge ||
          ' | deliver to: ' || v_o.delivery_line1 || ', ' || v_o.delivery_area || ', ' || v_o.delivery_city ||
          COALESCE(' | note: ' || v_o.delivery_notes, ''), auth.uid())
  RETURNING id INTO v_so;
  -- NOTE: sales_orders has no delivery-charge column, so it is folded into subtotal/notes. Confirm with ERP owner.

  INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price)
  SELECT v_so, product_id, quantity, unit_price FROM web_order_items WHERE web_order_id = v_o.id;

  UPDATE web_orders SET status = 'accepted', erp_sales_order_id = v_so, status_changed_at = now() WHERE id = v_o.id;
  INSERT INTO web_order_events (web_order_id, event_type, customer_note, actor_type, actor_id)
  VALUES (v_o.id, 'accepted', 'Your order is being reviewed by our team.', 'erp_staff', auth.uid());
  RETURN v_so;
END $$;

CREATE OR REPLACE FUNCTION public.reject_web_order(p_web_order UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.require_permission('sales', 'cancel');
  IF COALESCE(trim(p_reason), '') = '' THEN RAISE EXCEPTION 'A reason is required.'; END IF;
  UPDATE web_orders SET status = 'rejected', rejection_reason = p_reason, status_changed_at = now()
   WHERE id = p_web_order AND status = 'pending_confirmation';
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or no longer pending.'; END IF;
  INSERT INTO web_order_events (web_order_id, event_type, customer_note, actor_type, actor_id)
  VALUES (p_web_order, 'rejected', 'We could not accept this order. Please contact us.', 'erp_staff', auth.uid());
END $$;

REVOKE ALL ON FUNCTION public.convert_web_order(UUID, UUID), public.reject_web_order(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_web_order(UUID, UUID), public.reject_web_order(UUID, TEXT) TO authenticated;
-- (authenticated can call, but require_permission() rejects anyone without the ERP sales permission,
--  and website customers have no ERP permissions.)

-- ---- Public catalogue view: safe columns only; hides anything without an ERP price ---------
-- Price comes from web_current_price() (defined above in this file) and is NULL until the ERP price source is approved,
-- so the public catalogue stays empty rather than showing an invented price.
CREATE OR REPLACE VIEW public.web_catalog AS
SELECT d.product_id, d.slug, COALESCE(d.display_name, p.name) AS name, COALESCE(d.web_description, p.description) AS description,
       p.unit, d.category_slug, d.promo_label, d.is_featured, d.is_best_seller, d.sort_order, d.images, d.weight_options,
       public.web_price_or_null(p.id) AS price,
       CASE WHEN COALESCE(i.quantity_available, 0) <= 0 THEN 'out_of_stock'
            WHEN COALESCE(i.quantity_available, 0) <= p.min_stock_level THEN 'low_stock'
            ELSE 'in_stock' END AS availability       -- quantities themselves are never exposed
FROM public.product_display d
JOIN public.products p ON p.id = d.product_id AND p.is_active
LEFT JOIN public.inventory_levels i ON i.product_id = p.id
WHERE d.visible AND public.web_price_or_null(p.id) IS NOT NULL;


COMMIT;
