# Creating the development Supabase project (step 1)

Status: **instructions only. No project has been created.** Creating a Supabase project needs your Supabase account, which
Claude does not have. Everything below is for you (or your IT person) to do in the Supabase dashboard and your terminal.
Keys go into Vercel / `.env.local`, never into chat or git.

## A. Create the project
1. Supabase dashboard > **New project**. Name it clearly, for example `meatbond-dev`. Pick the same region as production.
   It must be a **new, separate** project. Do not reuse the production one (the project in the ERP's `.env.local`).
2. Save the database password in your password manager.
3. Settings > **API**: copy the Project URL and the **anon** key. Do **not** copy the service-role key anywhere.

## B. Put the ERP schema into it
The ERP repo already holds the schema as migrations 001-026. From the ERP repo folder (this only READS the ERP code):

    supabase link --project-ref <the NEW dev project ref>     # double-check it is the dev ref, not production
    supabase db push

### Known problem in the ERP repo: migrations 022 and 026 will fail
Running the real ERP migrations against a clean database showed that three function bodies are closed with `$;` instead of `$$;`:

| File | Line | Fix |
|---|---|---|
| `022_governance_foundation.sql` | 93 | `$;` -> `$$;` |
| `022_governance_foundation.sql` | 124 | `$;` -> `$$;` |
| `026_governance_investors_exits_compliance.sql` | 591 and 600 | opener `AS $` -> `AS $$`, closer `$;` -> `$$;` |

Migrations 001-021 and 023-025 apply cleanly. **Claude has not changed the ERP repo.** If you want, approve it and the
fix is a four-character edit plus a re-test. Your live database presumably received these some other way (for example pasted
in the SQL editor), so this only affects building a fresh project.

## C. Apply the website migrations (dev only)
In the dev project's SQL editor, run in order: `101`, `102`, `103`, `105`, `106` from `docs/erp-integration/migrations/`
(and `104` only if you approve stock reservation). Each is one transaction.

## D. Supabase settings (dev project)
- Authentication > Providers > **Email**: enabled, **Confirm email = ON**.
- Authentication > URL configuration: Site URL = your dev site URL; add redirect `<SITE_URL>/auth/callback`.
- Authentication > SMTP: add a real SMTP provider (the built-in sender is rate-limited).

## E. Connect the website to DEV
In the website's Vercel project (a **Preview** or separate dev deployment, not production) set:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `MART_AUTH=supabase`.
Add `MART_ADMIN=enabled` only on that dev deployment when you want to test the admin sign-in.

## F. Prove it (dev)
1. `SELECT public.site_admin_role();` as your ERP super admin returns `owner`; as a normal ERP user and as a customer it returns `NULL`.
2. Run `checks/rls_isolation_checks.sql` and the ERP's `supabase/checks/015_verify_access_control.sql`.
3. Register a customer with a real mailbox, verify, sign in, add an address, place an order.

## What was already proven without a Supabase project
`tools/db-tests` runs the ERP schema plus migrations 101-106 in a real in-memory PostgreSQL and checks behaviour
(85 checks: admin roles, customer IDs, isolation, orders, idempotency, stock reservation). See the security report, section 5.
