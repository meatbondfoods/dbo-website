-- =====================================================================
-- PROPOSED MIGRATION 102: website admin, content (draft/publish), product DISPLAY metadata
-- STATUS: FOR REVIEW ONLY. NOT APPLIED. Depends on 101. Apply to a verified DEV database first.
-- Additive only. Website admins are a SEPARATE role list (site_admins); they have no ERP rights.
-- product_display holds PRESENTATION data only. It deliberately has NO price or stock column:
-- price and availability always come from the ERP.
-- =====================================================================
BEGIN;

-- ---- Website administrators (separate from ERP user_profiles) ---------------------------
CREATE TABLE IF NOT EXISTS public.site_admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.site_admin_role()
RETURNS TEXT LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM site_admins WHERE user_id = auth.uid() AND is_active
$$;
CREATE OR REPLACE FUNCTION public.can_edit_site() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(public.site_admin_role() IN ('owner', 'editor'), FALSE) $$;

-- ---- Content with a DRAFT and a PUBLISHED copy per key -----------------------------------
-- keys: hero, banners, brand_assets, home_sections, featured_layout, promotions, categories_display,
--       navigation, footer, contact, social, seo, theme, commerce (delivery rule, enabled payment methods)
CREATE TABLE IF NOT EXISTS public.site_content (
  key        TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  data       JSONB NOT NULL,
  version    INT NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (key, status)
);
CREATE TABLE IF NOT EXISTS public.site_content_versions (   -- publish history, enables rollback
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL,
  version      INT NOT NULL,
  data         JSONB NOT NULL,
  published_by UUID REFERENCES auth.users(id),
  published_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.save_site_draft(p_key TEXT, p_data JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_edit_site() THEN RAISE EXCEPTION 'Not allowed.' USING ERRCODE = '42501'; END IF;
  INSERT INTO site_content (key, status, data, updated_by) VALUES (p_key, 'draft', p_data, auth.uid())
  ON CONFLICT (key, status) DO UPDATE SET data = EXCLUDED.data, updated_by = auth.uid(), updated_at = now(), version = site_content.version + 1;
  INSERT INTO site_audit_log (actor_id, action, target, detail) VALUES (auth.uid(), 'save_draft', p_key, NULL);
END $$;

-- Publishing is explicit and owner-only. The live site only ever reads status = 'published'.
CREATE OR REPLACE FUNCTION public.publish_site_content(p_key TEXT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_draft site_content; v_ver INT;
BEGIN
  IF public.site_admin_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Only an owner can publish.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_draft FROM site_content WHERE key = p_key AND status = 'draft';
  IF NOT FOUND THEN RAISE EXCEPTION 'No draft to publish for %.', p_key; END IF;
  SELECT COALESCE(max(version), 0) + 1 INTO v_ver FROM site_content_versions WHERE key = p_key;
  INSERT INTO site_content_versions (key, version, data, published_by) VALUES (p_key, v_ver, v_draft.data, auth.uid());
  INSERT INTO site_content (key, status, data, version, updated_by) VALUES (p_key, 'published', v_draft.data, v_ver, auth.uid())
  ON CONFLICT (key, status) DO UPDATE SET data = EXCLUDED.data, version = EXCLUDED.version, updated_by = auth.uid(), updated_at = now();
  INSERT INTO site_audit_log (actor_id, action, target, detail) VALUES (auth.uid(), 'publish', p_key, jsonb_build_object('version', v_ver));
  RETURN v_ver;
END $$;

CREATE OR REPLACE FUNCTION public.rollback_site_content(p_key TEXT, p_version INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_data JSONB;
BEGIN
  IF public.site_admin_role() IS DISTINCT FROM 'owner' THEN RAISE EXCEPTION 'Only an owner can roll back.' USING ERRCODE = '42501'; END IF;
  SELECT data INTO v_data FROM site_content_versions WHERE key = p_key AND version = p_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Version not found.'; END IF;
  PERFORM public.save_site_draft(p_key, v_data);
  PERFORM public.publish_site_content(p_key);
END $$;

-- ---- Audit log (append-only) -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID, action TEXT NOT NULL, target TEXT, detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.site_audit_append_only()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'site_audit_log is append-only.'; END $$;
DROP TRIGGER IF EXISTS trg_site_audit_ao ON public.site_audit_log;
CREATE TRIGGER trg_site_audit_ao BEFORE UPDATE OR DELETE ON public.site_audit_log FOR EACH ROW EXECUTE FUNCTION public.site_audit_append_only();

-- ---- Retail categories (website presentation, independent of the ERP product_category enum) ---
CREATE TABLE IF NOT EXISTS public.web_categories (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]+$'), name TEXT NOT NULL, description TEXT,
  sort_order INT NOT NULL DEFAULT 0, visible BOOLEAN NOT NULL DEFAULT TRUE
);

-- ---- Product DISPLAY metadata (no price, no stock) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.product_display (
  product_id      UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  visible         BOOLEAN NOT NULL DEFAULT FALSE,               -- nothing is public until an editor enables it
  slug            TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  display_name    TEXT,
  web_description TEXT,
  category_slug   TEXT REFERENCES public.web_categories(slug),
  promo_label     TEXT,
  is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
  is_best_seller  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INT NOT NULL DEFAULT 0,
  images          JSONB NOT NULL DEFAULT '[]'::JSONB,           -- storage paths in the 'site-media' bucket
  weight_options  JSONB NOT NULL DEFAULT '[]'::JSONB,           -- [{label, grams}] labels only; PRICES come from the ERP
  updated_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (The public web_catalog view is created in 103, after the ERP price lookup functions it uses.)

COMMIT;
