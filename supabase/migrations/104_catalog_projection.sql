-- =====================================================================
-- MIGRATION 104 (WEBSITE SUPABASE): ERP catalog projection + applied-event ledger
-- TARGET: the Website Supabase project (never the ERP project).
-- STATUS: not applied anywhere. Apply to a verified development project first.
--
-- The ERP is the source of truth for products, variants, approved prices and stock. This
-- project only holds a projection that the ERP pushes as signed events:
--   web_catalog_products   what the storefront shows (read-only to the public)
--   web_catalog_versions   per-product guards: newest snapshot version and newest stock version
--   web_catalog_events     ledger of every event received (idempotency and conflict detection)
-- All writes go through apply_catalog_event(), callable only by service_role.
-- Rollback: supabase/migrations/104_catalog_projection_rollback.sql
-- =====================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.web_catalog_categories (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.web_catalog_products (
  id                   TEXT PRIMARY KEY,               -- the ERP product id
  slug                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  category_id          TEXT NOT NULL REFERENCES public.web_catalog_categories(id),
  description          TEXT NOT NULL DEFAULT '',
  storage_instructions TEXT,
  images               JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- One entry per sellable variant: id (the ERP variant id), sku, label, grams, price,
  -- compareAtPrice, uomFactor, isAvailable. Prices are the ERP's approved prices.
  options              JSONB NOT NULL DEFAULT '[]'::JSONB,
  availability         TEXT NOT NULL CHECK (availability IN ('in_stock', 'low_stock', 'out_of_stock')),
  tags                 JSONB NOT NULL DEFAULT '[]'::JSONB,
  badge                TEXT,
  sort_order           INT NOT NULL DEFAULT 0,
  is_published         BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_catalog_products_published ON public.web_catalog_products (is_published, sort_order);

CREATE TABLE IF NOT EXISTS public.web_catalog_versions (
  aggregate_id        TEXT PRIMARY KEY,
  snapshot_version    BIGINT NOT NULL DEFAULT 0,        -- newest upsert/unpublish applied
  stock_version       BIGINT NOT NULL DEFAULT 0,        -- newest stock state applied
  stock_availability  TEXT,
  stock_variants      JSONB NOT NULL DEFAULT '[]'::JSONB,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.web_catalog_events (
  event_id           UUID PRIMARY KEY,
  event_type         TEXT NOT NULL,
  aggregate_id       TEXT NOT NULL,
  aggregate_version  BIGINT NOT NULL,
  body_hash          TEXT NOT NULL,
  outcome            TEXT NOT NULL CHECK (outcome IN ('applied', 'stale')),
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_web_catalog_events_aggregate ON public.web_catalog_events (aggregate_id, received_at DESC);

ALTER TABLE public.web_catalog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_catalog_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_catalog_versions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.web_catalog_events     ENABLE ROW LEVEL SECURITY;

-- The storefront may read published products and categories. Nothing else is readable or writable.
DROP POLICY IF EXISTS web_catalog_categories_read ON public.web_catalog_categories;
CREATE POLICY web_catalog_categories_read ON public.web_catalog_categories FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS web_catalog_products_read ON public.web_catalog_products;
CREATE POLICY web_catalog_products_read ON public.web_catalog_products FOR SELECT TO anon, authenticated USING (is_published);

REVOKE ALL ON public.web_catalog_categories, public.web_catalog_products,
              public.web_catalog_versions, public.web_catalog_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.web_catalog_categories, public.web_catalog_products TO anon, authenticated;

-- ---------------------------------------------------------------------
-- apply_catalog_event: atomically applies one verified ERP event.
-- Returns {status: applied | stale | duplicate | conflict | invalid}.
--   duplicate: same event id and same body already received (a retry): nothing changes
--   conflict : same event id, different body: refused
--   stale    : an equal or newer version of that part of the product was already applied
-- Content (upsert / unpublish) and stock are version-guarded separately, so a newer stock
-- event can never make a late-arriving price update look stale.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_catalog_event(p_event JSONB, p_body_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id        UUID;
  v_type      TEXT := p_event ->> 'eventType';
  v_agg       TEXT := p_event ->> 'aggregateId';
  v_ver       BIGINT;
  v_pay       JSONB := p_event -> 'payload';
  v_prev      public.web_catalog_events%ROWTYPE;
  v_cur       public.web_catalog_versions%ROWTYPE;
  v_outcome   TEXT := 'applied';
  v_avail     TEXT;
  v_stock_var JSONB;
  v_options   JSONB;
  v_cat       TEXT;
BEGIN
  BEGIN
    v_id  := (p_event ->> 'eventId')::UUID;
    v_ver := (p_event ->> 'aggregateVersion')::BIGINT;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'eventId or aggregateVersion is malformed');
  END;
  IF v_agg IS NULL OR length(v_agg) = 0 OR v_ver IS NULL OR v_ver < 0 OR p_body_hash IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'missing aggregate or hash');
  END IF;
  IF v_type NOT IN ('catalog.product.upsert', 'catalog.product.unpublish', 'catalog.stock.update') THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'unsupported event type');
  END IF;

  -- One writer per product at a time; the dedupe check below is then race-free.
  PERFORM pg_advisory_xact_lock(hashtext('web_catalog:' || v_agg));

  SELECT * INTO v_prev FROM public.web_catalog_events WHERE event_id = v_id;
  IF FOUND THEN
    IF v_prev.body_hash = p_body_hash THEN
      RETURN jsonb_build_object('status', 'duplicate', 'outcome', v_prev.outcome);
    END IF;
    RETURN jsonb_build_object('status', 'conflict');
  END IF;

  INSERT INTO public.web_catalog_versions (aggregate_id) VALUES (v_agg) ON CONFLICT (aggregate_id) DO NOTHING;
  SELECT * INTO v_cur FROM public.web_catalog_versions WHERE aggregate_id = v_agg;

  IF v_type = 'catalog.product.upsert' THEN
    IF v_ver <= v_cur.snapshot_version THEN
      v_outcome := 'stale';
    ELSE
      v_cat := v_pay ->> 'categoryId';
      INSERT INTO public.web_catalog_categories (id, slug, name)
      VALUES (v_cat,
              COALESCE(NULLIF(trim(BOTH '-' FROM lower(regexp_replace(COALESCE(v_pay ->> 'categoryName', v_cat), '[^a-zA-Z0-9]+', '-', 'g'))), ''), 'category'),
              COALESCE(v_pay ->> 'categoryName', v_cat))
      ON CONFLICT (id) DO NOTHING;

      -- Stock fields come from this snapshot only when it is newer than the newest stock state
      -- already applied; otherwise the newer stock state is kept.
      IF v_ver > v_cur.stock_version THEN
        v_avail := v_pay ->> 'availability';
        v_stock_var := COALESCE((SELECT jsonb_agg(jsonb_build_object('id', x ->> 'id', 'isAvailable', COALESCE((x ->> 'isAvailable')::BOOLEAN, FALSE)))
                                 FROM jsonb_array_elements(v_pay -> 'variants') x), '[]'::JSONB);
        UPDATE public.web_catalog_versions
           SET stock_version = v_ver, stock_availability = v_avail, stock_variants = v_stock_var, updated_at = now()
         WHERE aggregate_id = v_agg;
      ELSE
        v_avail := COALESCE(v_cur.stock_availability, 'out_of_stock');
        v_stock_var := v_cur.stock_variants;
      END IF;

      v_options := COALESCE((
        SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                 'id', x ->> 'id', 'sku', x ->> 'sku', 'label', x ->> 'label', 'variantType', x ->> 'variantType',
                 'grams', (x ->> 'grams')::NUMERIC, 'pieces', (x ->> 'pieces')::NUMERIC,
                 'uomFactor', (x ->> 'uomFactor')::NUMERIC,
                 'price', (x ->> 'price')::NUMERIC, 'compareAtPrice', (x ->> 'compareAtPrice')::NUMERIC,
                 -- unknown stock is never "available"
                 'isAvailable', COALESCE((SELECT (s ->> 'isAvailable')::BOOLEAN FROM jsonb_array_elements(v_stock_var) s WHERE s ->> 'id' = x ->> 'id'), FALSE)
               )) ORDER BY ord)
        FROM jsonb_array_elements(v_pay -> 'variants') WITH ORDINALITY AS t(x, ord)
      ), '[]'::JSONB);

      INSERT INTO public.web_catalog_products AS p
        (id, slug, name, category_id, description, storage_instructions, images, options, availability, tags, badge, sort_order, is_published, updated_at)
      VALUES (v_agg, v_pay ->> 'slug', v_pay ->> 'name', v_cat, COALESCE(v_pay ->> 'description', ''), v_pay ->> 'storageInstructions',
              COALESCE(v_pay -> 'images', '[]'::JSONB), v_options, v_avail, COALESCE(v_pay -> 'tags', '[]'::JSONB),
              v_pay ->> 'badge', COALESCE((v_pay ->> 'sortOrder')::INT, 0), TRUE, now())
      ON CONFLICT (id) DO UPDATE
        SET slug = EXCLUDED.slug, name = EXCLUDED.name, category_id = EXCLUDED.category_id, description = EXCLUDED.description,
            storage_instructions = EXCLUDED.storage_instructions, images = EXCLUDED.images, options = EXCLUDED.options,
            availability = EXCLUDED.availability, tags = EXCLUDED.tags, badge = EXCLUDED.badge,
            sort_order = EXCLUDED.sort_order, is_published = TRUE, updated_at = now();

      UPDATE public.web_catalog_versions SET snapshot_version = v_ver, updated_at = now() WHERE aggregate_id = v_agg;
    END IF;

  ELSIF v_type = 'catalog.product.unpublish' THEN
    IF v_ver <= v_cur.snapshot_version THEN
      v_outcome := 'stale';
    ELSE
      UPDATE public.web_catalog_products SET is_published = FALSE, updated_at = now() WHERE id = v_agg;
      UPDATE public.web_catalog_versions SET snapshot_version = v_ver, updated_at = now() WHERE aggregate_id = v_agg;
    END IF;

  ELSE  -- catalog.stock.update
    IF v_ver <= v_cur.stock_version THEN
      v_outcome := 'stale';
    ELSE
      v_avail := v_pay ->> 'availability';
      v_stock_var := COALESCE(v_pay -> 'variants', '[]'::JSONB);
      UPDATE public.web_catalog_versions
         SET stock_version = v_ver, stock_availability = v_avail, stock_variants = v_stock_var, updated_at = now()
       WHERE aggregate_id = v_agg;
      UPDATE public.web_catalog_products p
         SET availability = v_avail,
             options = COALESCE((
               SELECT jsonb_agg(o || jsonb_build_object('isAvailable',
                        COALESCE((SELECT (s ->> 'isAvailable')::BOOLEAN FROM jsonb_array_elements(v_stock_var) s WHERE s ->> 'id' = o ->> 'id'), FALSE))
                      ORDER BY ord)
               FROM jsonb_array_elements(p.options) WITH ORDINALITY AS t(o, ord)), '[]'::JSONB),
             updated_at = now()
       WHERE p.id = v_agg;
    END IF;
  END IF;

  INSERT INTO public.web_catalog_events (event_id, event_type, aggregate_id, aggregate_version, body_hash, outcome)
  VALUES (v_id, v_type, v_agg, v_ver, p_body_hash, v_outcome);

  RETURN jsonb_build_object('status', v_outcome);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_catalog_event(JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_event(JSONB, TEXT) TO service_role;

COMMIT;
