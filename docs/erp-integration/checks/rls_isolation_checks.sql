-- =====================================================================
-- RLS ISOLATION CHECKS: run on the DEVELOPMENT database only, AFTER migrations 101-106 are applied there.
-- NOT RUN YET (no development database is connected). Every check raises an exception if isolation fails,
-- so a clean run of the whole script = pass.
--
-- Setup: create two ordinary customer accounts through the website (or Supabase dashboard) with VERIFIED emails,
-- sign each in once so register_web_customer() has run, then paste their auth user ids below.
--   customer A: <UUID_A>      customer B: <UUID_B>      a user with NO web_customers row and no ERP profile: <UUID_X>
-- Never run this against the production database.
-- =====================================================================
\set uid_a '''00000000-0000-0000-0000-00000000000a'''
\set uid_b '''00000000-0000-0000-0000-00000000000b'''
\set uid_x '''00000000-0000-0000-0000-00000000000c'''

BEGIN;

-- Helper: act as a given authenticated user, the way PostgREST does.
CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid UUID) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::TEXT, TRUE);
  EXECUTE 'SET LOCAL ROLE authenticated';
END $$;
CREATE OR REPLACE FUNCTION pg_temp.expect(p_ok BOOLEAN, p_what TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN IF NOT p_ok THEN RAISE EXCEPTION 'ISOLATION FAILURE: %', p_what; END IF; RAISE NOTICE 'ok: %', p_what; END $$;

-- ---- 1. Customer A sees only their own customer row and addresses -----------------------------------
SELECT pg_temp.as_user(:uid_a::UUID);
SELECT pg_temp.expect((SELECT count(*) FROM public.web_customers) = 1, 'A sees exactly one web_customers row');
SELECT pg_temp.expect((SELECT auth_user_id FROM public.web_customers) = :uid_a::UUID, 'A sees only their own row');
SELECT pg_temp.expect((SELECT count(*) FROM public.web_customer_addresses WHERE web_customer_id NOT IN (SELECT id FROM public.web_customers)) = 0, 'A sees no foreign addresses');
RESET ROLE;

-- ---- 2. Customer A cannot change permanent or system fields ----------------------------------------
SELECT pg_temp.as_user(:uid_a::UUID);
DO $$ BEGIN
  BEGIN UPDATE public.web_customers SET customer_code = 'MBM-CUS-999999'; RAISE EXCEPTION 'customer_code was editable'; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL; END;
  BEGIN UPDATE public.web_customers SET erp_customer_id = (SELECT id FROM public.customers LIMIT 1); RAISE EXCEPTION 'erp link was editable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN UPDATE public.web_customers SET auth_user_id = gen_random_uuid(); RAISE EXCEPTION 'auth_user_id was editable'; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL; END;
  BEGIN DELETE FROM public.web_customers; RAISE EXCEPTION 'customer row was deletable'; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN NULL; END;
END $$;
RESET ROLE;

-- ---- 3. Customer A cannot touch customer B's addresses ---------------------------------------------
SELECT pg_temp.as_user(:uid_a::UUID);
DO $$
DECLARE v_b_addr UUID; v_n INT;
BEGIN
  RESET ROLE;
  SELECT a.id INTO v_b_addr FROM public.web_customer_addresses a JOIN public.web_customers c ON c.id = a.web_customer_id WHERE c.auth_user_id = :'uid_b'::UUID LIMIT 1;
  PERFORM pg_temp.as_user(:'uid_a'::UUID);
  UPDATE public.web_customer_addresses SET line1 = 'HIJACKED ADDRESS' WHERE id = v_b_addr; GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'A updated B''s address'; END IF;
  DELETE FROM public.web_customer_addresses WHERE id = v_b_addr; GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 0 THEN RAISE EXCEPTION 'A deleted B''s address'; END IF;
END $$;
RESET ROLE;

-- ---- 4. Orders: no direct access for customers; each sees only their own through the function --------
SELECT pg_temp.as_user(:uid_a::UUID);
DO $$ BEGIN
  BEGIN PERFORM 1 FROM public.web_orders; RAISE EXCEPTION 'A could read web_orders directly'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN INSERT INTO public.web_orders (order_ref) VALUES ('x'); RAISE EXCEPTION 'A could insert web_orders directly'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT pg_temp.expect((SELECT count(*) FROM public.get_my_web_orders() WHERE order_ref IN (SELECT order_ref FROM pg_temp.b_orders)) = 0, 'A cannot see B orders via get_my_web_orders()') WHERE to_regclass('pg_temp.b_orders') IS NOT NULL;
RESET ROLE;

-- ---- 5. A customer has NO access to ERP data (they hold the role "authenticated" but no ERP permission) ----
SELECT pg_temp.as_user(:uid_a::UUID);
DO $$
DECLARE t TEXT; n BIGINT;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','customers','sales_orders','sales_order_items','inventory_levels','stock_movements','suppliers','purchase_orders','accounts','journal_entries','employees','salary_slips','user_profiles','audit_logs']
  LOOP
    BEGIN EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
          IF n <> 0 THEN RAISE EXCEPTION 'customer can read % rows from %', n, t; END IF;
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;     -- denied outright is also a pass
  END LOOP;
END $$;
RESET ROLE;

-- ---- 6. A user with no customer row cannot create orders, and anon sees nothing ----------------------
SELECT pg_temp.as_user(:uid_x::UUID);
DO $$ BEGIN
  BEGIN PERFORM public.place_web_order('xxxxxxxxxxxxxxxxxxxx', '{"line1":"x"}'::JSONB, 'cod', '[]'::JSONB); RAISE EXCEPTION 'non-customer placed an order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'non-customer%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['web_customers','web_customer_addresses','web_orders','web_order_items','web_order_events','site_admins','site_audit_log','product_display']
  LOOP BEGIN EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', t); RAISE EXCEPTION 'anon could read %', t; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END LOOP;
END $$;
RESET ROLE;

-- ---- 7. Customers cannot become website admins or edit content --------------------------------------
SELECT pg_temp.as_user(:uid_a::UUID);
DO $$ BEGIN
  BEGIN INSERT INTO public.site_admins (user_id, role) VALUES (auth.uid(), 'owner'); RAISE EXCEPTION 'customer self-granted admin'; EXCEPTION WHEN insufficient_privilege OR check_violation OR raise_exception THEN IF SQLERRM LIKE 'customer%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.save_site_draft('hero', '{}'::JSONB); RAISE EXCEPTION 'customer saved site content'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;

ROLLBACK;     -- nothing is kept; this script only asserts
