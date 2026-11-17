-- =====================================================================
-- PROPOSED MIGRATION 105: RLS and grants for every new web_* / site_* table
-- STATUS: FOR REVIEW ONLY. NOT APPLIED. Run after 101-103 (and 104 if approved).
-- Principle: deny by default. anon gets NOTHING on tables; public reads go through the
-- published-content view and the safe catalogue view. Customers read only their own rows.
-- NO existing ERP table or policy is changed.
-- =====================================================================
BEGIN;

-- Deny by default.
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['web_customers','web_customer_addresses','web_orders','web_order_items','web_order_events',
                           'web_order_counters','site_admins','site_content','site_content_versions','site_audit_log',
                           'web_categories','product_display']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
  END LOOP;
END $$;
REVOKE ALL ON public.web_order_counters FROM authenticated;       -- internal only

-- ---- Customers: own rows only -------------------------------------------------------------
CREATE POLICY web_customers_own_select ON public.web_customers FOR SELECT TO authenticated USING (auth_user_id = (SELECT auth.uid()));
CREATE POLICY web_customers_own_update ON public.web_customers FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid())) WITH CHECK (auth_user_id = (SELECT auth.uid()));
GRANT SELECT ON public.web_customers TO authenticated;
GRANT UPDATE (full_name, email) ON public.web_customers TO authenticated;   -- column-level: code/phone/ERP link are not editable

CREATE POLICY web_addresses_own ON public.web_customer_addresses FOR ALL TO authenticated
  USING (web_customer_id IN (SELECT id FROM public.web_customers WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (web_customer_id IN (SELECT id FROM public.web_customers WHERE auth_user_id = (SELECT auth.uid())));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_customer_addresses TO authenticated;

-- Orders are created ONLY through place_web_order() and read through get_my_web_orders().
-- No direct table access for customers.
REVOKE ALL ON public.web_orders, public.web_order_items, public.web_order_events FROM authenticated;

-- ---- ERP staff: read the inbox through the ERP's existing permission model -----------------
CREATE POLICY web_orders_staff_view ON public.web_orders FOR SELECT TO authenticated USING ((SELECT public.has_permission('sales', 'view')));
CREATE POLICY web_order_items_staff_view ON public.web_order_items FOR SELECT TO authenticated USING ((SELECT public.has_permission('sales', 'view')));
CREATE POLICY web_order_events_staff_view ON public.web_order_events FOR SELECT TO authenticated USING ((SELECT public.has_permission('sales', 'view')));
GRANT SELECT ON public.web_orders, public.web_order_items, public.web_order_events TO authenticated;
-- Customers hold 'authenticated' but have no ERP permission, so has_permission() is FALSE for them.
-- Staff see a customer's phone/address here, which they already see in the ERP customers module.

-- ---- Content: public reads PUBLISHED only; admins read/write drafts via the functions -------
CREATE POLICY site_content_public_published ON public.site_content FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY site_content_admin_read ON public.site_content FOR SELECT TO authenticated USING (public.site_admin_role() IS NOT NULL);
GRANT SELECT ON public.site_content TO anon, authenticated;      -- writes ONLY via save_site_draft()/publish_site_content()
CREATE POLICY site_versions_admin ON public.site_content_versions FOR SELECT TO authenticated USING (public.site_admin_role() IS NOT NULL);
GRANT SELECT ON public.site_content_versions TO authenticated;
CREATE POLICY site_audit_admin ON public.site_audit_log FOR SELECT TO authenticated USING (public.site_admin_role() = 'owner');
GRANT SELECT ON public.site_audit_log TO authenticated;
CREATE POLICY site_admins_self ON public.site_admins FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR public.site_admin_role() = 'owner');
GRANT SELECT ON public.site_admins TO authenticated;

CREATE POLICY web_categories_public ON public.web_categories FOR SELECT TO anon, authenticated USING (visible OR public.site_admin_role() IS NOT NULL);
CREATE POLICY web_categories_edit ON public.web_categories FOR ALL TO authenticated USING (public.can_edit_site()) WITH CHECK (public.can_edit_site());
GRANT SELECT ON public.web_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.web_categories TO authenticated;

CREATE POLICY product_display_admin ON public.product_display FOR ALL TO authenticated USING (public.can_edit_site()) WITH CHECK (public.can_edit_site());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_display TO authenticated;
-- The public never reads product_display directly: only the web_catalog view.

GRANT SELECT ON public.web_catalog TO anon, authenticated;   -- safe columns only (see 102)

-- ---- Required verification before any customer can sign in (run on DEV) ---------------------
-- 1. As a signed-in website customer (no user_profiles row), SELECT from: products, customers, sales_orders,
--    inventory_levels, suppliers, accounts, employees, salary_slips  => every query must return 0 rows or be denied.
-- 2. As anon, the same queries and web_orders/web_customers must be denied.
-- 3. Re-run supabase/checks/015_verify_access_control.sql from the ERP repo.
COMMIT;
