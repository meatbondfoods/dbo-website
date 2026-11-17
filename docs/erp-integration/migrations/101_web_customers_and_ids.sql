-- =====================================================================
-- PROPOSED MIGRATION 101: website customers, permanent IDs, phone matching
-- STATUS: FOR REVIEW ONLY. NOT APPLIED. Apply to a verified DEV database first.
-- Additive only: creates new web_* objects. Does NOT alter any existing ERP table.
-- =====================================================================
BEGIN;

-- ---- Permanent, never-reused customer codes: MBM-CUS-000001 --------------
CREATE SEQUENCE IF NOT EXISTS public.web_customer_code_seq AS BIGINT START 1 NO CYCLE;

-- ---- Phone normalisation (Bangladesh mobile -> E.164) --------------------
-- Used for OTP identity AND for matching against ERP customers.phone (free text).
CREATE OR REPLACE FUNCTION public.normalize_bd_phone(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN d ~ '^8801[3-9][0-9]{8}$' THEN '+' || d
    WHEN d ~ '^01[3-9][0-9]{8}$'   THEN '+88' || d
    ELSE NULL
  END
  FROM (SELECT regexp_replace(COALESCE(p, ''), '[^0-9]', '', 'g') AS d) s
$$;

-- ---- Website customers ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_code    TEXT NOT NULL UNIQUE
                   DEFAULT ('MBM-CUS-' || lpad(nextval('public.web_customer_code_seq')::TEXT, 6, '0')),
  full_name        TEXT NOT NULL CHECK (length(trim(full_name)) >= 2),
  phone_e164       TEXT NOT NULL UNIQUE CHECK (phone_e164 ~ '^\+8801[3-9][0-9]{8}$'),
  phone_verified_at TIMESTAMPTZ NOT NULL,          -- set only after a successful OTP verification
  email            TEXT,
  -- Link to the ERP customer. Written only by the matching function or by ERP staff conversion.
  erp_customer_id  UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  erp_match_status TEXT NOT NULL DEFAULT 'unmatched'
                   CHECK (erp_match_status IN ('unmatched', 'matched', 'needs_review', 'linked_by_staff')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer code and verified phone are permanent: block edits.
CREATE OR REPLACE FUNCTION public.web_customers_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.customer_code IS DISTINCT FROM OLD.customer_code THEN RAISE EXCEPTION 'customer_code is permanent.'; END IF;
  IF NEW.auth_user_id  IS DISTINCT FROM OLD.auth_user_id  THEN RAISE EXCEPTION 'auth_user_id is permanent.'; END IF;
  IF NEW.phone_e164    IS DISTINCT FROM OLD.phone_e164    THEN RAISE EXCEPTION 'A verified phone change must go through re-verification.'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_web_customers_immutable ON public.web_customers;
CREATE TRIGGER trg_web_customers_immutable BEFORE UPDATE ON public.web_customers
  FOR EACH ROW EXECUTE FUNCTION public.web_customers_immutable();

-- Codes are never reused, even after deletion: forbid DELETE outright.
CREATE OR REPLACE FUNCTION public.web_customers_no_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Website customers are never deleted (customer codes are permanent).'; END $$;
DROP TRIGGER IF EXISTS trg_web_customers_no_delete ON public.web_customers;
CREATE TRIGGER trg_web_customers_no_delete BEFORE DELETE ON public.web_customers
  FOR EACH ROW EXECUTE FUNCTION public.web_customers_no_delete();

-- ---- Delivery addresses --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.web_customer_addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  web_customer_id UUID NOT NULL REFERENCES public.web_customers(id) ON DELETE CASCADE,
  label           TEXT NOT NULL DEFAULT 'Home',
  line1           TEXT NOT NULL CHECK (length(trim(line1)) >= 5),
  area            TEXT NOT NULL,
  city            TEXT NOT NULL DEFAULT 'Dhaka',
  notes           TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_web_default_address
  ON public.web_customer_addresses (web_customer_id) WHERE is_default;

-- ---- Register after OTP: creates the website customer ---------------------
-- Called with the customer's OWN session (no service role). The phone comes from the
-- verified auth user, never from client input, so it cannot be spoofed.
CREATE OR REPLACE FUNCTION public.register_web_customer(p_full_name TEXT, p_email TEXT DEFAULT NULL)
RETURNS TABLE (customer_code TEXT, erp_match_status TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_phone TEXT; v_verified TIMESTAMPTZ; v_matches INT; v_erp UUID; v_status TEXT := 'unmatched';
  v_row public.web_customers;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT normalize_bd_phone(u.phone), u.phone_confirmed_at INTO v_phone, v_verified FROM auth.users u WHERE u.id = v_uid;
  IF v_phone IS NULL OR v_verified IS NULL THEN RAISE EXCEPTION 'A verified Bangladesh mobile number is required.'; END IF;

  -- Idempotent: an existing website customer returns as-is.
  SELECT * INTO v_row FROM web_customers WHERE auth_user_id = v_uid;
  IF FOUND THEN RETURN QUERY SELECT v_row.customer_code, v_row.erp_match_status; RETURN; END IF;

  -- Duplicate prevention against ERP customers. This only READS the ERP table.
  -- Exactly one match => link. More than one => flag for staff. Zero => stay unmatched
  -- (staff create or link the ERP customer when converting the first order).
  SELECT count(*), (array_agg(c.id))[1] INTO v_matches, v_erp
    FROM customers c WHERE normalize_bd_phone(c.phone) = v_phone;
  IF v_matches = 1 THEN v_status := 'matched'; ELSIF v_matches > 1 THEN v_status := 'needs_review'; v_erp := NULL; ELSE v_erp := NULL; END IF;

  INSERT INTO web_customers (auth_user_id, full_name, phone_e164, phone_verified_at, email, erp_customer_id, erp_match_status)
  VALUES (v_uid, trim(p_full_name), v_phone, v_verified, NULLIF(trim(p_email), ''), v_erp, v_status)
  RETURNING * INTO v_row;
  RETURN QUERY SELECT v_row.customer_code, v_row.erp_match_status;
END $$;

REVOKE ALL ON FUNCTION public.register_web_customer(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_web_customer(TEXT, TEXT) TO authenticated;

COMMIT;
