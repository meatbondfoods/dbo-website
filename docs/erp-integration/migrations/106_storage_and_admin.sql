-- =====================================================================
-- PROPOSED MIGRATION 106: image storage for site content, and website-admin helpers
-- STATUS: FOR REVIEW ONLY. NOT APPLIED. Depends on 102 (site_admins, can_edit_site()). Apply to DEV first.
-- Bucket "site-media" holds hero / banner / logo / social images uploaded by website admins.
-- Public READ (images are shown on the public site); WRITE only for site admins with the editor/owner role.
-- The application also validates every upload (PNG/JPEG/WebP only, max 2 MB, type from file bytes, random name);
-- the bucket limits below are a second, database-side line of defence. SVG is not allowed (it can carry scripts).
-- =====================================================================
BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-media', 'site-media', TRUE, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS site_media_public_read ON storage.objects;
CREATE POLICY site_media_public_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'site-media');

DROP POLICY IF EXISTS site_media_admin_insert ON storage.objects;
CREATE POLICY site_media_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-media' AND public.can_edit_site());

DROP POLICY IF EXISTS site_media_admin_update ON storage.objects;
CREATE POLICY site_media_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-media' AND public.can_edit_site()) WITH CHECK (bucket_id = 'site-media' AND public.can_edit_site());

DROP POLICY IF EXISTS site_media_admin_delete ON storage.objects;
CREATE POLICY site_media_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-media' AND public.site_admin_role() IS NOT DISTINCT FROM 'owner');

-- ---- Website admins --------------------------------------------------------------------------------
-- ERP SUPER ADMINS NEED NO SETUP: site_admin_role() (migration 102) treats an active ERP super admin as a website
-- owner, using the same Supabase login they already use for the ERP.
--
-- Anyone else (for example a marketing editor who is NOT an ERP user) is added by a database administrator after
-- that person has created and verified a normal Supabase Auth account. There is deliberately NO application path
-- that grants admin rights:
--
--   INSERT INTO public.site_admins (user_id, role)
--   SELECT id, 'editor' FROM auth.users WHERE email = '<editor email>';     -- or 'viewer'
--
-- Customers can never reach site_admins: it has RLS enabled and no INSERT/UPDATE policy for any role.
-- Admin sign-in uses the same Supabase Auth, then the server checks site_admin_role() on every request.
-- Enabling /admin on the deployed site additionally requires explicit owner approval (see middleware.ts).

COMMIT;
