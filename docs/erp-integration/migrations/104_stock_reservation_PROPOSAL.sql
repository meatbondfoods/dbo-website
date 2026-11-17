-- =====================================================================
-- PROPOSAL 104 (ERP-SIDE, REQUIRES OWNER APPROVAL): stock reservation for WEB orders
-- STATUS: FOR REVIEW ONLY. NOT APPLIED. This touches ERP inventory logic, so it must be approved
-- explicitly and tested on a verified DEV database.
--
-- Verified current state (see 01-findings.md): inventory_levels.quantity_reserved exists but nothing
-- writes it; nothing deducts stock on a sale; movement_type has no reservation value.
--
-- Agreed workflow:   order placed = no stock change
--                    ERP confirms = RESERVE     ERP dispatches = DEDUCT     ERP cancels = RELEASE
--
-- SAFETY SCOPE: triggers act ONLY on sales orders that were created from a web order
-- (web_orders.erp_sales_order_id). Every existing ERP sales order behaves exactly as today.
-- Widening this to all sales orders is a separate business decision.
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.stock_reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id),
  product_id     UUID NOT NULL REFERENCES public.products(id),
  quantity       NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'consumed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at      TIMESTAMPTZ,
  UNIQUE (sales_order_id, product_id)                     -- one reservation per line item: idempotent
);

CREATE OR REPLACE FUNCTION public.is_web_sales_order(p_so UUID) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.web_orders WHERE erp_sales_order_id = p_so) $$;

-- RESERVE on confirmation. Fails (and so blocks the status change) if stock is insufficient.
CREATE OR REPLACE FUNCTION public.reserve_stock_for_so(p_so UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_avail NUMERIC;
BEGIN
  FOR r IN SELECT product_id, sum(quantity) AS qty FROM sales_order_items WHERE sales_order_id = p_so GROUP BY product_id LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM stock_reservations WHERE sales_order_id = p_so AND product_id = r.product_id AND status = 'active');
    SELECT quantity_available INTO v_avail FROM inventory_levels WHERE product_id = r.product_id FOR UPDATE;
    IF COALESCE(v_avail, 0) < r.qty THEN RAISE EXCEPTION 'Insufficient available stock to confirm this order (product %).', r.product_id; END IF;
    UPDATE inventory_levels SET quantity_reserved = quantity_reserved + r.qty, last_updated = now() WHERE product_id = r.product_id;
    INSERT INTO stock_reservations (sales_order_id, product_id, quantity) VALUES (p_so, r.product_id, r.qty)
    ON CONFLICT (sales_order_id, product_id) DO UPDATE SET status = 'active', quantity = EXCLUDED.quantity, closed_at = NULL;
  END LOOP;
END $$;

-- RELEASE on cancellation/rejection.
CREATE OR REPLACE FUNCTION public.release_stock_for_so(p_so UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM stock_reservations WHERE sales_order_id = p_so AND status = 'active' FOR UPDATE LOOP
    UPDATE inventory_levels SET quantity_reserved = GREATEST(quantity_reserved - r.quantity, 0), last_updated = now() WHERE product_id = r.product_id;
    UPDATE stock_reservations SET status = 'released', closed_at = now() WHERE id = r.id;
  END LOOP;
END $$;

-- DEDUCT on dispatch: consumes the reservation, reduces on-hand, writes the existing 'sales_out' movement.
CREATE OR REPLACE FUNCTION public.deduct_stock_for_so(p_so UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD; v_on_hand NUMERIC;
BEGIN
  FOR r IN SELECT * FROM stock_reservations WHERE sales_order_id = p_so AND status = 'active' FOR UPDATE LOOP
    UPDATE inventory_levels SET quantity_on_hand = quantity_on_hand - r.quantity,
           quantity_reserved = GREATEST(quantity_reserved - r.quantity, 0), last_updated = now()
     WHERE product_id = r.product_id RETURNING quantity_on_hand INTO v_on_hand;
    IF v_on_hand < 0 THEN RAISE EXCEPTION 'Stock cannot go below zero (product %).', r.product_id; END IF;
    INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, notes, created_by)
    VALUES (r.product_id, 'sales_out', r.quantity, 'sales_order', p_so, 'Dispatched web order', auth.uid());
    UPDATE stock_reservations SET status = 'consumed', closed_at = now() WHERE id = r.id;
  END LOOP;
END $$;

-- Wire to status changes, AFTER the ERP's own workflow trigger has approved the change.
-- SECURITY DEFINER so staff who change an order's status can trigger the (API-locked) reserve/deduct/release functions.
CREATE OR REPLACE FUNCTION public.web_so_stock_trigger() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NOT public.is_web_sales_order(NEW.id) THEN RETURN NEW; END IF;
  IF NEW.status::TEXT = 'confirmed'  THEN PERFORM public.reserve_stock_for_so(NEW.id);
  ELSIF NEW.status::TEXT = 'dispatched' THEN PERFORM public.reserve_stock_for_so(NEW.id); PERFORM public.deduct_stock_for_so(NEW.id);  -- covers skip-ahead
  ELSIF NEW.status::TEXT = 'cancelled'  THEN PERFORM public.release_stock_for_so(NEW.id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_web_so_stock ON public.sales_orders;
CREATE TRIGGER trg_web_so_stock AFTER UPDATE OF status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.web_so_stock_trigger();

REVOKE ALL ON FUNCTION public.reserve_stock_for_so(UUID), public.release_stock_for_so(UUID), public.deduct_stock_for_so(UUID) FROM PUBLIC, anon, authenticated;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stock_reservations FROM PUBLIC, anon, authenticated;     -- only the SECURITY DEFINER functions write it
GRANT SELECT ON public.stock_reservations TO authenticated;
CREATE POLICY stock_reservations_view ON public.stock_reservations FOR SELECT TO authenticated
  USING ((SELECT public.has_permission('inventory', 'view')) OR (SELECT public.has_permission('stock', 'view')));

COMMIT;
