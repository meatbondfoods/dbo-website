ALTER TABLE public.web_orders      DROP COLUMN IF EXISTS customer_email;
ALTER TABLE public.web_order_items DROP COLUMN IF EXISTS option_id;
