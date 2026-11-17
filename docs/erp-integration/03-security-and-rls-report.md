# Security and RLS report (Phase 3)

Status: **review document.** Controls marked *tested* were exercised in this repository (unit tests and a real-browser test run
against the development provider). Anything involving Supabase itself is *written, not yet run*: no Supabase project is connected.

## 1. What was built and how it is protected

| Area | Control | Where | Verified |
|---|---|---|---|
| Passwords | Handled by Supabase Auth in production. The dev provider uses scrypt with a per-user salt; plain text is never stored or logged. | `auth/password.ts` | Tested |
| Password policy | 10-128 chars, letter + number, common passwords refused. | `auth/password.ts`, `auth/schemas.ts` | Tested |
| Email verification | Required before sign-in. Customer ID is issued only after verification. Tokens are random, hashed at rest, single-use, expiring. | `auth/demoAccounts.ts`; Supabase "Confirm email" + `register_web_customer()` | Tested (dev); Supabase untested |
| No account enumeration | Register, forgot-password and login return the same answer whether or not an email exists; login does equal work for unknown emails. | `auth/demoAccounts.ts`, routes | Tested |
| Brute force | Per-IP rate limits on auth routes; 5 failed logins lock an account for 15 minutes. | `routeAuth.ts`, `demoAccounts.ts` | Tested. **Rate limiter is in memory (per server instance): use a shared store before launch.** |
| Sessions | httpOnly, SameSite=Lax cookie (Secure in production); only a hash of the token is stored; reset signs out every session; logout destroys the session server-side. | `auth/service.ts`, `demoStore.ts` | Tested |
| CSRF | Every cookie-authenticated mutation checks `Origin` / `Sec-Fetch-Site`. | `http.ts` `sameOrigin()` | Tested in browser run |
| Ownership | The customer id used for every profile / address / order query comes **only from the verified session**. Request bodies cannot name a customer. Another customer's address or order returns 404. | `routeAuth.ts`, `demoStore.ts` | Tested |
| Immutable Customer ID | Sequence-issued, never reused, no UPDATE/DELETE path; separate from the auth UUID. | `demoStore.ts`; migration 101 triggers | Tested (dev); SQL syntax-checked only |
| Admin auth | Separate admin cookie and scope. Role (viewer / editor / owner) is read from the server-side store on every request. A customer session never works as an admin session. | `adminAuth.ts` | Tested |
| Admin roles | viewer: read. editor: drafts, preview, upload. owner: publish, rollback. | API routes | Tested |
| Admin exposure | `/admin` and `/api/admin/*` return 404 on every deployed site (middleware + layout + each route). | `middleware.ts` | Tested on production build and live |
| Uploads | Type decided from file bytes (PNG/JPEG/WebP only, SVG refused), 2 MB limit, random server-chosen name, editors only. | `media.ts`, `api/admin/upload` | Tested |
| Content safety | Links must be `/path` or `https://`; image paths cannot contain `..`; theme publish blocked below WCAG 4.5:1. | `content/schema.ts` | Tested |
| Secrets | No service-role key anywhere in the website. Customer data access uses the customer's own session. Only `NEXT_PUBLIC_` Supabase URL + anon key are used, and only when `MART_AUTH=supabase`. | `auth/config.ts` | Reviewed |
| Order integrity | Price, totals, delivery and status are computed server-side; payment is never marked paid by the website. | `repositories/demo.ts`; `place_web_order()` | Tested (demo) |

## 2. RLS matrix (migrations 101-106, **proposed, not applied**)

| Table | anon | Customer (`authenticated`) | Website admin | ERP staff (existing `has_permission`) |
|---|---|---|---|---|
| `web_customers` | none | SELECT own; UPDATE own `full_name`, `phone` only | none | none |
| `web_customer_addresses` | none | full CRUD on own rows | none | none |
| `web_orders`, `web_order_items`, `web_order_events` | none | **no direct access**; read own via `get_my_web_orders()` | none | SELECT (sales.view); convert/reject via functions |
| `web_order_counters` | none | none | none | none |
| `site_content` | published rows only | published rows only | drafts via functions (editor); publish/rollback (owner) | none |
| `site_admins` | none | none, cannot self-grant | read own / owner reads all; **no write policy** | none |
| `product_display` | none (public sees `web_catalog` view) | none | editor CRUD | none |
| `storage: site-media` | read | read | editor insert/update, owner delete | none |
| ERP tables (products, customers, sales_orders, inventory, accounting, HR, ...) | unchanged | unchanged: blocked because customers have no `user_profiles` row, so `is_active_user()` is false | unchanged | unchanged |

No existing ERP table, policy, function or trigger is modified by 101-103 and 105-106. Migration 104 (stock reservation) adds triggers
on `sales_orders` for web-originated orders only and still needs your explicit approval.

## 3. Test plan for the development database

1. Apply 101, 102, 103, 105, 106 to the **dev** project (never production).
2. Run `supabase/checks/015_verify_access_control.sql` from the ERP repo to confirm customers still cannot reach ERP data.
3. Run `checks/rls_isolation_checks.sql` (this folder). Any isolation failure raises an exception.
4. Walk the sign-up flow with a real mailbox: register, receive the email, verify, sign in, add an address, place an order.
5. Confirm in Supabase **Auth > Providers > Email** that "Confirm email" is ON, and that unverified users cannot sign in.

## 4. Known gaps and risks

1. **Supabase provider untested.** `auth/supabaseAccounts.ts` follows the documented API but has never run against a live project.
2. **Shared `auth.users`.** Customers and ERP staff share one auth table. Safety rests on the ERP policies requiring a `user_profiles` row. This is read from the migration files and must be proven on dev (test plan steps 2-3).
3. **No verified phone.** Email auth cannot prove a phone number, so ERP customer matching must be staff-confirmed (`needs_review`), not automatic.
4. **Email delivery.** Supabase's built-in email sender is rate-limited and unsuitable for production; a custom SMTP provider is required.
5. **Rate limiting and lockout** in the dev provider are per-process. Production needs a shared store (for example Upstash) or Supabase Auth's own limits.
6. **No MFA** for website admins yet. Recommended before enabling `/admin` in production.
7. **Image hosting.** Dev uploads go to `public/uploads` (not deployed). Production needs the `site-media` bucket (106) wired to the admin session.
8. **On hold.** The ERP `sales_order_status` has no "on hold" value. It is modelled on the web inbox record until the ERP mapping is agreed.
9. **Password breach checking** (for example Have I Been Pwned) is not implemented; Supabase offers leaked-password protection on paid plans.

## 5. Verified by execution in PostgreSQL (added after Phase 3)

The migrations were run for real, not only parsed: the ERP's migrations 001-026 plus website migrations 101-106 were loaded into an
in-memory PostgreSQL (`tools/db-tests`, PGlite) with Supabase's roles, `auth.uid()` and storage imitated, and 85 behavioural
checks were executed as an ERP super admin, an ordinary ERP user, a website editor, two customers and an anonymous visitor.
**85 / 85 pass.** This is a rehearsal on a stand-in database, not the real Supabase project.

Confirmed by execution:
- ERP super admin is a website owner; an ordinary ERP user, an editor-less customer and anonymous visitors are not; deactivating the super admin in the ERP removes access immediately.
- Unverified emails get no Customer ID; IDs are sequential, idempotent, separate from the auth UUID, and cannot be edited or deleted.
- A customer sees 0 rows in 18 ERP tables (products, customers, suppliers, accounting, HR, governance...); anonymous visitors see nothing private.
- Customer A cannot read, change, delete or create anything under customer B (addresses, orders).
- Orders: pending confirmation, server-side totals, idempotency (replay and conflicting replay), COD only, no stock change on order, blocked while no ERP price source exists.
- Staff conversion makes a DRAFT sales order; confirm reserves stock; dispatch deducts it and writes a `sales_out` movement; cancel releases it; ordinary (non-web) ERP orders are untouched; an order cannot be confirmed when stock has gone.
- Draft/publish/rollback, owner-only publish, append-only audit log, storage bucket rules (customers cannot upload; editors and super admins can; the public can read).

### Defects this found (all fixed in the migration files)
1. **Customers could edit their own `erp_customer_id` and `email`.** Supabase gives the API roles broad table privileges by default and a column-level GRANT only adds to them. 105 now revokes first and then grants exactly what is needed.
2. **The anonymous catalogue broke** once helper functions were locked down, because PostgreSQL checks EXECUTE on functions inside a view against the caller. `web_price_or_null` is now SECURITY DEFINER and explicitly executable.
3. **Stock trigger could not call the locked-down reserve/deduct/release functions** when run by ERP staff. The trigger function is now SECURITY DEFINER.
4. Internal helpers (`next_web_order_ref`, `web_current_price`) and `stock_reservations` writes are no longer reachable by API roles.

### Still not covered
Real Supabase Auth (email delivery, JWT handling), the PostgREST layer, performance, and concurrent requests. The rehearsal is single-connection.
