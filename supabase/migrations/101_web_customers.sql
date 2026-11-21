-- =====================================================================
-- MIGRATION 101 (WEBSITE SUPABASE): website customers, permanent IDs, addresses. EMAIL + PASSWORD auth.
-- Adapted from docs/erp-integration/migrations/101: the only change is that erp_customer_id has no foreign key,
-- because the ERP and the website are separate Supabase projects (the website has no customers table).
-- STATUS: not applied anywhere. Apply to a verified development project first.
-- Rollback: supabase/migrations/101_web_customers_rollback.sql
-- =====================================================================
BEGIN;

-- ---- Permanent, never-reused customer codes -------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.web_customer_code_seq AS BIGINT START 1 NO CYCLE;

-- ---- Phone normalisation (Bangladesh mobile -> E.164), used for validation of contact numbers ------
CREATE OR REPLACE FUNCTION public.normalize_bd_phone(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d ~ '^8801[3-9][0-9]{8}$' THEN '+' || d
    WHEN d ~ '^01[3-9][0-9]{8}$'   THEN '+88' || d
    ELSE NULL
  END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g') AS d) s
$$;

-- ---- Website customers -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id      UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_code     TEXT NOT NULL UNIQUE
                    DEFAULT ('MBM-CUS-' || lpad(nextval('public.web_customer_code_seq')::TEXT, 6, '0')),
  full_name         TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
  email             TEXT NOT NULL,                              -- copied from auth.users at creation (read-only here)
  phone             TEXT CHECK (phone IS NULL OR phone ~ '^\+8801[3-9][0-9]{8}$'),   -- contact number, NOT verified
  email_verified_at TIMESTAMPTZ NOT NULL,                       -- taken from auth.users.email_confirmed_at
  erp_customer_id   UUID,   -- the ERP customer id (plain value, no foreign key: the ERP is a SEPARATE project); set only by ERP staff / matching phase
  erp_match_status  TEXT NOT NULL DEFAULT 'unmatched'
                    CHECK (erp_match_status IN ('unmatched', 'needs_review', 'linked_by_staff')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.web_customers_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.customer_code     IS DISTINCT FROM OLD.customer_code     THEN RAISE EXCEPTION 'customer_code is permanent.'; END IF;
  IF NEW.auth_user_id      IS DISTINCT FROM OLD.auth_user_id      THEN RAISE EXCEPTION 'auth_user_id is permanent.'; END IF;
  IF NEW.id                IS DISTINCT FROM OLD.id                THEN RAISE EXCEPTION 'id is permanent.'; END IF;
  IF NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at THEN RAISE EXCEPTION 'email_verified_at is managed by the system.'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_web_customers_immutable ON public.web_customers;
CREATE TRIGGER trg_web_customers_immutable BEFORE UPDATE ON public.web_customers
  FOR EACH ROW EXECUTE FUNCTION public.web_customers_immutable();

-- A customer code is never reissued, even after account removal: forbid DELETE outright.
CREATE OR REPLACE FUNCTION public.web_customers_no_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Website customers are never deleted (customer codes are permanent).'; END $$;
DROP TRIGGER IF EXISTS trg_web_customers_no_delete ON public.web_customers;
CREATE TRIGGER trg_web_customers_no_delete BEFORE DELETE ON public.web_customers
  FOR EACH ROW EXECUTE FUNCTION public.web_customers_no_delete();

-- ---- Delivery addresses ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_customer_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_customer_id UUID NOT NULL REFERENCES public.web_customers(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
  phone           TEXT NOT NULL CHECK (phone ~ '^\+8801[3-9][0-9]{8}$'),
  line1           TEXT NOT NULL CHECK (length(trim(line1)) >= 5),
  area            TEXT NOT NULL CHECK (length(trim(area)) >= 2),
  city            TEXT NOT NULL DEFAULT 'Dhaka',
  postal_code     TEXT NOT NULL DEFAULT '' CHECK (postal_code ~ '^([0-9]{4})?$'),
  instructions    TEXT NOT NULL DEFAULT '' CHECK (length(instructions) <= 300),
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_web_default_address ON public.web_customer_addresses (web_customer_id) WHERE is_default;

-- At most 10 addresses per customer; the first one is the default; marking one default clears the others.
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

-- ---- Create the website customer on first verified sign-in ---------------------------------------
-- Runs as the CUSTOMER (their own session). Idempotent. Refuses an unverified email, so an account only gets a
-- customer ID after it has proved it owns the email address. The email comes from auth.users, never from input.
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
    VALUES (v_uid, left(trim(COALESCE(NULLIF(p_full_name, ''), 'Customer')), 100), v_email, normalize_bd_phone(p_phone), v_verified)
    ON CONFLICT (auth_user_id) DO NOTHING;
    SELECT * INTO v_row FROM web_customers WHERE auth_user_id = v_uid;     -- also covers a concurrent first call
  END IF;
  RETURN QUERY SELECT v_row.id, v_row.customer_code, v_row.full_name, v_row.phone;
END $$;

REVOKE ALL ON FUNCTION public.register_web_customer(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_web_customer(TEXT, TEXT) TO authenticated;

COMMIT;
