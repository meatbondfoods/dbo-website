# Database behaviour tests (no Supabase needed)

Loads the ERP's migrations (read from the ERP repo, never modified) and the website migrations
`docs/erp-integration/migrations/101-106` into a throw-away, in-memory PostgreSQL (PGlite) that imitates Supabase
(roles `anon` / `authenticated` / `service_role`, `auth.users`, `auth.uid()`, storage). It then acts as an ERP super
admin, an ordinary ERP user, a website editor, two customers and an anonymous visitor, and checks the real behaviour:
admin roles, customer IDs, row-level security isolation, the order inbox, idempotency, stock reservation.

    cd tools/db-tests
    npm install
    ERP_REPO="D:/MeatBond Foods" npm test        # prints PASS / FAIL for each check

Nothing here connects to Supabase or any real database. It is a rehearsal, not a replacement for running the
migrations on the real development project, but it catches privilege, trigger and logic mistakes that a syntax check cannot.

Note: ERP migrations 022 and 026 contain `$;` typos (should be `$$;`). This harness repairs them IN MEMORY only so the rest
can load; see docs/erp-integration/05-dev-project-setup.md.
