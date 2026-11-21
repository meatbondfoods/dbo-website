-- Rollback for website migration 105. DATA LOSS: any order still waiting in the queue would no
-- longer be sent to the ERP automatically. Refuses to run while unsent orders exist.
-- To drop anyway: SET app.confirm_drop_unsent_orders = 'yes';
BEGIN;
DO $$
DECLARE v_unsent BIGINT;
BEGIN
  IF to_regclass('public.web_order_dispatch') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.web_order_dispatch WHERE status <> ''sent''' INTO v_unsent;
    IF v_unsent > 0 AND COALESCE(current_setting('app.confirm_drop_unsent_orders', true), '') <> 'yes' THEN
      RAISE EXCEPTION 'Refusing to drop the order queue: % order(s) have not reached the ERP. Run: SET app.confirm_drop_unsent_orders = ''yes''; first.', v_unsent;
    END IF;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.order_dispatch_stats();
DROP FUNCTION IF EXISTS public.requeue_order_dispatch(TEXT);
DROP FUNCTION IF EXISTS public.release_order_dispatch(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.mark_order_dispatch_failed(TEXT, TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.mark_order_dispatch_sent(TEXT, INT, TEXT);
DROP FUNCTION IF EXISTS public.claim_order_dispatch(TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.enqueue_order_dispatch(TEXT, TEXT, TEXT);
DROP TABLE IF EXISTS public.web_order_dispatch;
COMMIT;
