-- ============================================================================
-- MEATBOND MART: CUSTOMER ACCOUNTS & REGISTRATION SCHEMA
-- Project: hiwqrazleuxzrqverbqc.supabase.co
-- Target: Apply in Supabase Dashboard -> SQL Editor -> Click 'Run'
-- ============================================================================

BEGIN;

-- 1. Ensure fallback for ERP customers table if not yet loaded
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Customer ID sequence: MBM-CUS-000001 (immutable, atomic)
CREATE SEQUENCE IF NOT EXISTS public.web_customer_code_seq AS BIGINT START 1 NO CYCLE;

-- 3. Phone normalisation helper function (Bangladesh mobile -> E.164)
CREATE OR REPLACE FUNCTION public.normalize_bd_phone(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d ~ '^8801[3-9][0-9]{8}$' THEN '+' || d
    WHEN d ~ '^01[3-9][0-9]{8}$'   THEN '+88' || d
    ELSE NULL
  END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g') AS d) s
$$;

-- 4. Website Customers Table
CREATE TABLE IF NOT EXISTS public.web_customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_code     TEXT NOT NULL UNIQUE
                    DEFAULT ('MBM-CUS-' || lpad(nextval('public.web_customer_code_seq')::TEXT, 6, '0')),
  full_name         TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
  email             TEXT NOT NULL,
  phone             TEXT CHECK (phone IS NULL OR phone ~ '^\+8801[3-9][0-9]{8}$'),
  email_verified_at TIMESTAMPTZ NOT NULL,
  erp_customer_id   UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  erp_match_status  TEXT NOT NULL DEFAULT 'unmatched'
                    CHECK (erp_match_status IN ('unmatched', 'needs_review', 'linked_by_staff')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Protect permanent fields from modification or deletion
CREATE OR REPLACE FUNCTION public.web_customers_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.customer_code     IS DISTINCT FROM OLD.customer_code     THEN RAISE EXCEPTION 'customer_code is permanent.'; END IF;
  IF NEW.auth_user_id      IS DISTINCT FROM OLD.auth_user_id      THEN RAISE EXCEPTION 'auth_user_id is permanent.'; END IF;
  IF NEW.email             IS DISTINCT FROM OLD.email             THEN RAISE EXCEPTION 'email is permanent.'; END IF;
  IF NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN RAISE EXCEPTION 'email_verified_at is permanent.'; END IF;
  IF NEW.erp_customer_id   IS DISTINCT FROM OLD.erp_customer_id   AND pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'erp_customer_id can only be linked through the integration process.';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_web_customers_immutable ON public.web_customers;
CREATE TRIGGER trg_web_customers_immutable BEFORE UPDATE ON public.web_customers
  FOR EACH ROW EXECUTE FUNCTION public.web_customers_immutable();

CREATE OR REPLACE FUNCTION public.web_customers_no_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Customer records cannot be deleted. Customer IDs are never reissued.';
END $$;

DROP TRIGGER IF EXISTS trg_web_customers_no_delete ON public.web_customers;
CREATE TRIGGER trg_web_customers_no_delete BEFORE DELETE ON public.web_customers
  FOR EACH ROW EXECUTE FUNCTION public.web_customers_no_delete();

-- 5. Saved Delivery Addresses Table
CREATE TABLE IF NOT EXISTS public.web_customer_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_customer_id UUID NOT NULL REFERENCES public.web_customers(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
  phone           TEXT NOT NULL CHECK (phone ~ '^\+8801[3-9][0-9]{8}$'),
  line1           TEXT NOT NULL CHECK (length(trim(line1)) >= 3),
  area            TEXT NOT NULL CHECK (length(trim(area)) >= 2),
  city            TEXT NOT NULL CHECK (length(trim(city)) >= 2),
  postal_code     TEXT,
  instructions    TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_web_default_address ON public.web_customer_addresses (web_customer_id) WHERE is_default;

CREATE OR REPLACE FUNCTION public.web_addresses_rules()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF (SELECT count(*) FROM public.web_customer_addresses WHERE web_customer_id = NEW.web_customer_id) >= 10 THEN
      RAISE EXCEPTION 'You can save up to 10 addresses.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.web_customer_addresses WHERE web_customer_id = NEW.web_customer_id) THEN NEW.is_default := TRUE; END IF;
  END IF;
  IF NEW.is_default AND pg_trigger_depth() = 1 THEN
    UPDATE public.web_customer_addresses SET is_default = FALSE WHERE web_customer_id = NEW.web_customer_id AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_web_addresses_rules ON public.web_customer_addresses;
CREATE TRIGGER trg_web_addresses_rules BEFORE INSERT OR UPDATE ON public.web_customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.web_addresses_rules();

-- 6. Atomic Customer Registration Function (register_web_customer)
CREATE OR REPLACE FUNCTION public.register_web_customer(p_full_name TEXT, p_phone TEXT DEFAULT NULL)
RETURNS TABLE (customer_id UUID, customer_code TEXT, full_name TEXT, phone TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
#variable_conflict use_column
DECLARE
  v_uid UUID := auth.uid(); v_email TEXT; v_verified TIMESTAMPTZ; v_row public.web_customers;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT u.email, u.email_confirmed_at INTO v_email, v_verified FROM auth.users u WHERE u.id = v_uid;
  IF v_verified IS NULL THEN RAISE EXCEPTION 'Verify your email address first.'; END IF;

  SELECT * INTO v_row FROM web_customers WHERE auth_user_id = v_uid;
  IF NOT FOUND THEN
    INSERT INTO web_customers (auth_user_id, full_name, email, phone, email_verified_at)
    VALUES (v_uid, left(trim(COALESCE(NULLIF(p_full_name, ''), 'Customer')), 100), COALESCE(v_email, ''), normalize_bd_phone(p_phone), v_verified)
    ON CONFLICT (auth_user_id) DO NOTHING;
    SELECT * INTO v_row FROM web_customers WHERE auth_user_id = v_uid;
  END IF;
  RETURN QUERY SELECT v_row.id, v_row.customer_code, v_row.full_name, v_row.phone;
END $$;

REVOKE ALL ON FUNCTION public.register_web_customer(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_web_customer(TEXT, TEXT) TO authenticated;

-- 7. Row Level Security (RLS) & Permissions
ALTER TABLE public.web_customers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_customers FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS web_customers_own_select ON public.web_customers;
CREATE POLICY web_customers_own_select ON public.web_customers FOR SELECT TO authenticated USING (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS web_customers_own_update ON public.web_customers;
CREATE POLICY web_customers_own_update ON public.web_customers FOR UPDATE TO authenticated
  USING (auth_user_id = (SELECT auth.uid())) WITH CHECK (auth_user_id = (SELECT auth.uid()));

GRANT SELECT ON public.web_customers TO authenticated;
GRANT UPDATE (full_name, phone) ON public.web_customers TO authenticated;

ALTER TABLE public.web_customer_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_customer_addresses FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS web_addresses_own ON public.web_customer_addresses;
CREATE POLICY web_addresses_own ON public.web_customer_addresses FOR ALL TO authenticated
  USING (web_customer_id IN (SELECT id FROM public.web_customers WHERE auth_user_id = (SELECT auth.uid())))
  WITH CHECK (web_customer_id IN (SELECT id FROM public.web_customers WHERE auth_user_id = (SELECT auth.uid())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.web_customer_addresses TO authenticated;

COMMIT;
