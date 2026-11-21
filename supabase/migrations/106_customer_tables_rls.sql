-- =====================================================================
-- MIGRATION 106 (WEBSITE SUPABASE): row-level security for customer and counter tables
-- TARGET: the Website Supabase project (never the ERP project).
-- STATUS: not applied anywhere. Apply to a verified development project first.
--
-- Migrations 101 and 103 created web_customers, web_customer_addresses, web_order_counters and a
-- registry table WITHOUT row-level security. Hosted Supabase grants anon/authenticated full
-- privileges on new public tables by default, so without this migration anyone holding the public
-- anon key could read or change customer names, phones, emails and addresses.
--
-- After this migration:
--   * customers can read only their own profile and change only full_name and phone
--   * customers manage only their own delivery addresses
--   * web_order_counters and the registry have no API access at all
--   * next_web_order_ref() (which burns order numbers) is callable by the server only
-- Rollback: supabase/migrations/106_customer_tables_rls_rollback.sql
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.web_customers') IS NULL OR to_regclass('public.web_orders') IS NULL THEN
    RAISE EXCEPTION 'Migration 106 requires migrations 101 and 103 to be applied first.';
  END IF;
END $$;

-- Deny by default. A later GRANT only adds to existing privileges, so everything is revoked first.
ALTER TABLE public.web_customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_order_counters     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_migration_103_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_customers, public.web_customer_addresses,
              public.web_order_counters, public.web_migration_103_registry FROM PUBLIC, anon, authenticated;

-- Customers: own profile only; only full_name and phone may be changed (code, email, auth id,
-- verification and the ERP link are managed by the system and by ERP staff).
DROP POLICY IF EXISTS web_customers_own_select ON public.web_customers;
CREATE POLICY web_customers_own_select ON public.web_customers FOR SELECT TO authenticated
  USING (auth_user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS web_customers_own_update ON public.web_customers;
CREATE POLICY web_customers_own_update ON public.web_customers FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid())) WITH CHECK (auth_user_id = (SELECT auth.uid()));
GRANT SELECT ON public.web_customers TO authenticated;
GRANT UPDATE (full_name, phone) ON public.web_customers TO authenticated;

-- Delivery addresses: own rows only.
DROP POLICY IF EXISTS web_addresses_own ON public.web_customer_addresses;
CREATE POLICY web_addresses_own ON public.web_customer_addresses FOR ALL TO authenticated
  USING (web_customer_id IN (SELECT id FROM public.web_customers WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (web_customer_id IN (SELECT id FROM public.web_customers WHERE auth_user_id = (SELECT auth.uid())));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_customer_addresses TO authenticated;

-- Server-only: the service role bypasses RLS, and these have no policies for anyone else.
-- Burning order numbers from the browser would let anyone exhaust the reference sequence.
REVOKE ALL ON FUNCTION public.next_web_order_ref() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_web_order_ref() TO service_role;

COMMIT;
