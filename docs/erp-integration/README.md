# MeatBond Mart ↔ ERP integration: working documents

**Nothing in this folder has been applied to any database.** SQL files are proposals for review.

| File | What it is |
|---|---|
| `01-findings.md` | Read-only investigation: dev-project verification, selling-price gap, stock-reservation state, ERP workflow, auth. |
| `02-architecture-and-api-contracts.md` | Proposed architecture, status model, API and function contracts. |
| `migrations/101_web_customers_and_ids.sql` | Website customers (email + password auth), permanent `MBM-CUS-` IDs, addresses. |
| `migrations/102_site_cms.sql` | Site admins, draft/publish content, product display metadata. |
| `migrations/103_web_order_inbox.sql` | Order inbox, `place_web_order`, ERP conversion. Price lookup is a deliberate stub. |
| `migrations/104_stock_reservation_PROPOSAL.sql` | Reserve / deduct / release for web orders. **Changes ERP inventory logic: needs explicit approval.** |
| `migrations/105_rls_and_grants.sql` | RLS and grants, plus the verification checklist to run on dev. |
| `migrations/106_storage_and_admin.sql` | Image storage bucket and its policies; website-admin bootstrap notes. |
| `05-dev-project-setup.md` | How to create the dev Supabase project, load the ERP schema, apply 101-106, and the ERP migration typos found. |
| `../../tools/db-tests` | Runs the ERP schema + 101-106 in an in-memory PostgreSQL and executes 85 behavioural checks. |
| `03-security-and-rls-report.md` | Security controls, RLS matrix, test plan, known gaps. |
| `checks/rls_isolation_checks.sql` | SQL to run on the DEV database to prove customers cannot see each other's data. |

Apply order: 101, 102, 103, 105, 106 (and 104 only if approved). Each file is one transaction.
Syntax of all six files was checked with the PostgreSQL parser (`libpg-query`); they have **not** been executed.
