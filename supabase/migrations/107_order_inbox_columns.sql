-- 107: additive columns the order repository writes (email for "my orders", the catalogue option id per line).
-- Safe to re-run. No data is changed or removed.
ALTER TABLE public.web_orders      ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.web_order_items ADD COLUMN IF NOT EXISTS option_id      TEXT;
