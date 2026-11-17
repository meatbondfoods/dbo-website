# Connecting MeatBond Mart to the ERP: runbook

Status: **prepared, not executed.** Nothing below has been run against any Supabase project. The website is **not**
connected to the ERP today. This is the exact order in which the connection should be made, DEV FIRST.

## What "connected" will mean

| Area | How it connects | Built? |
|---|---|---|
| **ERP super admin = website owner** | Same Supabase login. `site_admin_role()` (migration 102) returns `owner` for an active ERP super admin by calling the ERP's own `is_super_admin()`. Deactivating the user in the ERP removes website-admin access immediately. | SQL **verified in a real PostgreSQL** (tools/db-tests); website sign-in code untested against Supabase |
| Other website admins (editor / viewer) | Rows in `site_admins`, added by a database administrator. | SQL written |
| Customers | Supabase Auth (same project) + `web_customers` with permanent `MBM-CUS-` IDs. They have no `user_profiles` row, so the ERP treats them as having no access. | Code + SQL written; **untested** |
| Orders | Customer order -> `place_web_order()` -> ERP **inbox** (`web_orders`) as *Pending confirmation* -> ERP staff convert it to a **draft** sales order -> existing ERP approval workflow. | SQL written; **ERP "Web Orders" screen not built** |
| Products, prices, stock | Read from the ERP. **Blocked:** the ERP has no persisted selling price. | Not built |
| Stock reservation | Reserve on confirm, deduct on dispatch, release on cancel (web orders only). | SQL proposal (104); needs your approval |

## Step by step

### 0. Preconditions (you)
1. A **development** Supabase project that contains a copy of the ERP schema (ERP migrations 001-026). It must NOT be the production project.
2. Add these to the website's Vercel project (or a local `.env.local` for development). Do not paste keys in chat:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`.
   The service-role key is **not** used by the website and must not be added.
3. Supabase dashboard (dev project): Auth > Providers > Email enabled; **Confirm email ON**; redirect URL `<SITE_URL>/auth/callback`; a custom SMTP provider for real emails.

### 1. Apply the database changes to DEV only
Apply in order: `101`, `102`, `103`, `105`, `106` (and `104` only if you approve it). Then:
1. Run the ERP's `supabase/checks/015_verify_access_control.sql` on dev.
2. Run `checks/rls_isolation_checks.sql` (this folder). Any isolation failure raises an exception.

### 2. Prove the ERP super admin is a website owner (dev)
1. Sign in to the **ERP** (dev) as a super admin to confirm that login works.
2. In the SQL editor, as that user: `SELECT public.site_admin_role();` must return `owner`.
3. As an ordinary ERP user (not super admin) it must return `NULL`; as a website customer it must return `NULL`.

### 3. Turn the website on against DEV (not production)
Set on the dev deployment only: `MART_AUTH=supabase` and `MART_ADMIN=enabled`. Both are required; either alone keeps
the admin area at 404. Then `/admin/login` accepts the ERP super admin's ERP email and password.

### 4. Still to build before orders are real
1. **A selling-price source in the ERP** (price column or ERP-owned price table): needs your decision.
2. **Supabase-backed content store** for the admin CMS (today drafts and published content are in a local file, so a
   deployed admin could not save). The functions already exist in migration 102.
3. **The ERP adapter** behind the website's repository layer (catalog + orders), replacing the demo data.
4. **The ERP "Web Orders" inbox screen** (list, review, convert, reject) in the ERP app. This changes the ERP app, so it needs your approval.

### 5. Production go-live (only after dev passes everything and you approve each item)
Apply the same migrations to production, set the production env vars, and only then set `MART_ADMIN=enabled`.
Recommended first: two-step login for admins, a shared rate-limit store, and a rollback plan.

## Safety properties already in the code
- Without `MART_ADMIN=enabled` **and** `MART_AUTH=supabase` **and** the Supabase keys, `/admin` and `/api/admin/*` return 404 on any deployed site.
- Demo accounts and the demo admin cannot run in production.
- The admin role is computed in the database on every request; the browser can never supply it.
- A user who signs in successfully but is not an admin is signed straight back out (no session is kept).
- If the role lookup errors, access is denied (fail closed).
- The website never holds the service-role key.
