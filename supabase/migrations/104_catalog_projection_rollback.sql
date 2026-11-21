-- Rollback for website migration 104. Drops the ERP catalog projection and its event ledger.
-- DATA LOSS: the projection is rebuilt by the ERP re-sending a snapshot, but the ledger is lost.
-- Requires: SET app.confirm_catalog_projection_drop = 'yes';
BEGIN;
DO $$
BEGIN
  IF COALESCE(current_setting('app.confirm_catalog_projection_drop', true), '') <> 'yes' THEN
    RAISE EXCEPTION 'Refusing to drop the catalog projection. Run: SET app.confirm_catalog_projection_drop = ''yes''; first.';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.apply_catalog_event(JSONB, TEXT);
DROP TABLE IF EXISTS public.web_catalog_events;
DROP TABLE IF EXISTS public.web_catalog_versions;
DROP TABLE IF EXISTS public.web_catalog_products;
DROP TABLE IF EXISTS public.web_catalog_categories;
COMMIT;
