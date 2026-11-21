-- Rollback for website migration 101. DATA LOSS: removes website customer accounts and addresses.
-- Requires: SET app.confirm_drop_web_customers = 'yes';  Roll back 105, 104 and 103 first (103 references web_customers).
BEGIN;
DO $$
BEGIN
  IF COALESCE(current_setting('app.confirm_drop_web_customers', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'Refusing to drop website customers. Run: SET app.confirm_drop_web_customers = ''yes''; first.';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.register_web_customer(TEXT, TEXT);
DROP TABLE IF EXISTS public.web_customer_addresses;
DROP TABLE IF EXISTS public.web_customers;
DROP FUNCTION IF EXISTS public.web_addresses_rules();
DROP FUNCTION IF EXISTS public.web_customers_no_delete();
DROP FUNCTION IF EXISTS public.web_customers_immutable();
DROP FUNCTION IF EXISTS public.normalize_bd_phone(TEXT);
DROP SEQUENCE IF EXISTS public.web_customer_code_seq;
COMMIT;
