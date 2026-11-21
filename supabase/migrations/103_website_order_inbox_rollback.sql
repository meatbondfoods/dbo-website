-- =====================================================================
-- MIGRATION 103 ROLLBACK (WEBSITE SUPABASE)
-- TARGET: Website Supabase (hiwqrazleuxzrqverbqc)
-- STATUS: DRAFT ONLY - DO NOT EXECUTE AGAINST REMOTE DATABASE
-- Non-destructive rollback: only drops objects marked created_by_migration = TRUE
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'web_migration_103_registry'
  ) THEN
    RAISE NOTICE 'web_migration_103_registry does not exist. Nothing to roll back.';
    RETURN;
  END IF;

  -- 1. Drop Policies
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'policy' AND object_name = 'web_order_events_service_all ON web_order_events') THEN
    DROP POLICY IF EXISTS web_order_events_service_all ON public.web_order_events;
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'policy' AND object_name = 'web_order_items_service_all ON web_order_items') THEN
    DROP POLICY IF EXISTS web_order_items_service_all ON public.web_order_items;
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'policy' AND object_name = 'web_orders_service_all ON web_orders') THEN
    DROP POLICY IF EXISTS web_orders_service_all ON public.web_orders;
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'policy' AND object_name = 'web_order_events_cust_select ON web_order_events') THEN
    DROP POLICY IF EXISTS web_order_events_cust_select ON public.web_order_events;
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'policy' AND object_name = 'web_order_items_cust_select ON web_order_items') THEN
    DROP POLICY IF EXISTS web_order_items_cust_select ON public.web_order_items;
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'policy' AND object_name = 'web_orders_cust_select ON web_orders') THEN
    DROP POLICY IF EXISTS web_orders_cust_select ON public.web_orders;
  END IF;

  -- 2. Drop Triggers
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'trigger' AND object_name = 'trg_web_order_events_ao') THEN
    DROP TRIGGER IF EXISTS trg_web_order_events_ao ON public.web_order_events;
  END IF;

  -- 3. Drop Functions
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'function' AND object_name = 'web_order_events_append_only()') THEN
    DROP FUNCTION IF EXISTS public.web_order_events_append_only();
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'function' AND object_name = 'get_my_web_orders()') THEN
    DROP FUNCTION IF EXISTS public.get_my_web_orders();
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'function' AND object_name = 'get_public_order_tracking(text,text)') THEN
    DROP FUNCTION IF EXISTS public.get_public_order_tracking(TEXT, TEXT);
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'function' AND object_name = 'next_web_order_ref()') THEN
    DROP FUNCTION IF EXISTS public.next_web_order_ref();
  END IF;

  -- 4. Drop Tables (in reverse dependency order)
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'table' AND object_name = 'web_order_events') THEN
    DROP TABLE IF EXISTS public.web_order_events CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'table' AND object_name = 'web_order_items') THEN
    DROP TABLE IF EXISTS public.web_order_items CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'table' AND object_name = 'web_orders') THEN
    DROP TABLE IF EXISTS public.web_orders CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM public.web_migration_103_registry WHERE object_type = 'table' AND object_name = 'web_order_counters') THEN
    DROP TABLE IF EXISTS public.web_order_counters CASCADE;
  END IF;

  -- 5. Drop Registry Table
  DROP TABLE IF EXISTS public.web_migration_103_registry CASCADE;
  RAISE NOTICE 'Migration 103 (Website) rollback completed successfully.';
END $$;

COMMIT;
