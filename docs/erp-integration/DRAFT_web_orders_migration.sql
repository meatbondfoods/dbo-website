-- =====================================================================
-- DRAFT ONLY - NOT APPLIED. Do not run against any database until reviewed.
-- Proposed ERP migration for MeatBond Mart web orders.
--
-- Before use:
--   1. Compare against the LIVE schema (supabase db dump --schema public --schema-only).
--      The repo migrations contain no products.selling_price, though the ERP app
--      type expects one. Adjust section 1 to whatever already exists.
--   2. Apply to the DEV project first, never straight to production.
--   3. Copy into the ERP repo as supabase/migrations/027_*.sql only once approved.
--
-- Design: additive only. No existing column, policy or function is changed.
-- The website never touches ERP tables directly; it calls web_* objects below
-- with the service-role key from server-side code only.
-- =====================================================================
BEGIN;

-- 1. Pricing + web visibility on products (additive, nullable-safe) ----
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS selling_price     NUMERIC(12,2) CHECK (selling_price IS NULL OR selling_price >= 0),
  ADD COLUMN IF NOT EXISTS web_published     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS web_slug          TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS web_category      TEXT,         -- retail category: chicken / beef / mutton / processed
  ADD COLUMN IF NOT EXISTS web_sort_order    INTEGER NOT NULL DEFAULT 0;

-- 2. Web-order fields on sales_orders ----------------------------------
ALTER TABLE public.sales_orders
  ADD COLUMN IF NOT EXISTS channel           TEXT NOT NULL DEFAULT 'erp',   -- 'erp' | 'web'
  ADD COLUMN IF NOT EXISTS delivery_charge   NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method    TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_address  TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_orders_idempotency_key
  ON public.sales_orders (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. Restricted catalogue view: only what the storefront may see --------
--    No cost_price, no min/max stock, no supplier data.
CREATE OR REPLACE VIEW public.web_catalog AS
SELECT p.id, p.code, p.web_slug AS slug, p.name, p.description, p.image_url,
       p.unit, p.selling_price AS price, p.web_category AS category, p.web_sort_order,
       COALESCE(i.quantity_available, 0) AS quantity_available
FROM public.products p
LEFT JOIN public.inventory_levels i ON i.product_id = p.id
WHERE p.is_active AND p.web_published AND p.selling_price IS NOT NULL;

REVOKE ALL ON public.web_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.web_catalog TO service_role;

-- 4. Transactional order placement --------------------------------------
--    p_lines: [{"product_id": uuid, "quantity": number}]
--    Prices come from products.selling_price, never from the caller.
--    Stock rule is a PLACEHOLDER (reserve on order); confirm the business rule first.
CREATE OR REPLACE FUNCTION public.place_web_order(
  p_idempotency_key TEXT,
  p_customer_name   TEXT,
  p_phone           TEXT,
  p_email           TEXT,
  p_address         TEXT,
  p_city            TEXT,
  p_payment_method  TEXT,
  p_delivery_charge NUMERIC,
  p_lines           JSONB
) RETURNS TABLE (order_id UUID, order_number TEXT, status TEXT, total_amount NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_customer UUID; v_order UUID; v_number TEXT; v_line JSONB;
  v_price NUMERIC; v_avail NUMERIC; v_qty NUMERIC; v_subtotal NUMERIC := 0;
BEGIN
  -- Duplicate submission: return the original order.
  SELECT so.id, so.order_number, so.status::TEXT, so.total_amount
    INTO order_id, order_number, status, total_amount
    FROM sales_orders so WHERE so.idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN NEXT; RETURN; END IF;

  IF jsonb_array_length(p_lines) = 0 THEN RAISE EXCEPTION 'Order has no lines.'; END IF;

  -- Find or create a retail customer by phone (customers.phone is NOT NULL, code UNIQUE).
  SELECT id INTO v_customer FROM customers WHERE phone = p_phone ORDER BY created_at LIMIT 1;
  IF v_customer IS NULL THEN
    INSERT INTO customers (code, name, type, phone, email, address, city)
    VALUES ('WEB-' || substr(md5(p_phone), 1, 8), p_customer_name, 'retail', p_phone, p_email, p_address, p_city)
    RETURNING id INTO v_customer;
  END IF;

  v_number := 'WEB-' || to_char(now(), 'YYMMDD') || '-' || lpad((floor(random() * 100000))::TEXT, 5, '0');
  INSERT INTO sales_orders (order_number, customer_id, status, channel, delivery_charge,
                            payment_method, idempotency_key, delivery_address, notes)
  VALUES (v_number, v_customer, 'draft', 'web', p_delivery_charge, p_payment_method,
          p_idempotency_key, p_address || ', ' || p_city, 'Placed via MeatBond Mart')
  RETURNING id INTO v_order;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_qty := (v_line ->> 'quantity')::NUMERIC;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity.'; END IF;

    SELECT p.selling_price, COALESCE(i.quantity_available, 0) INTO v_price, v_avail
      FROM products p LEFT JOIN inventory_levels i ON i.product_id = p.id
     WHERE p.id = (v_line ->> 'product_id')::UUID AND p.is_active AND p.web_published
       FOR UPDATE OF p;
    IF v_price IS NULL THEN RAISE EXCEPTION 'Product unavailable.'; END IF;
    IF v_avail < v_qty THEN RAISE EXCEPTION 'Insufficient stock.'; END IF;

    INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price)
    VALUES (v_order, (v_line ->> 'product_id')::UUID, v_qty, v_price);

    -- Reserve stock (placeholder rule; deduction on dispatch stays an ERP decision).
    UPDATE inventory_levels SET quantity_reserved = quantity_reserved + v_qty, last_updated = now()
     WHERE product_id = (v_line ->> 'product_id')::UUID;

    v_subtotal := v_subtotal + v_price * v_qty;
  END LOOP;

  UPDATE sales_orders SET subtotal = v_subtotal, total_amount = v_subtotal + p_delivery_charge
   WHERE id = v_order;

  RETURN QUERY SELECT v_order, v_number, 'draft'::TEXT, v_subtotal + p_delivery_charge;
END $$;

-- Callable only by the website's server-side service role.
REVOKE ALL ON FUNCTION public.place_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_web_order(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC,JSONB) TO service_role;

-- NOTE: web orders start as 'draft' so staff review/confirm them through the ERP's
-- existing workflow triggers and approval limits. Delivery-charge pricing and the
-- "customers by phone" matching rule are open questions for the business.

COMMIT;
