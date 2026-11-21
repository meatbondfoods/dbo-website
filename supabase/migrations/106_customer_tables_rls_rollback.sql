-- Rollback for website migration 106. WARNING: this RE-OPENS customer data (names, phones, emails,
-- addresses) to anyone holding the public anon key. Requires: SET app.confirm_reopen_customer_data = 'yes';
BEGIN;
DO $$
BEGIN
  IF COALESCE(current_setting('app.confirm_reopen_customer_data', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'Refusing to re-open customer data. Run: SET app.confirm_reopen_customer_data = ''yes''; first.';
  END IF;
END $$;
DROP POLICY IF EXISTS web_customers_own_select ON public.web_customers;
DROP POLICY IF EXISTS web_customers_own_update ON public.web_customers;
DROP POLICY IF EXISTS web_addresses_own ON public.web_customer_addresses;
ALTER TABLE public.web_customers          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_customer_addresses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_order_counters     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_migration_103_registry DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.web_customers, public.web_customer_addresses, public.web_order_counters,
             public.web_migration_103_registry TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_web_order_ref() TO PUBLIC, anon, authenticated;
COMMIT;
