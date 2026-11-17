# MeatBond Mart ↔ ERP integration: working documents

**Nothing in this folder has been applied to any database.** SQL files are proposals for review.

| File | What it is |
|---|---|
| `01-findings.md` | Read-only investigation: dev-project verification, selling-price gap, stock-reservation state, ERP workflow, auth. |
| `02-architecture-and-api-contracts.md` | Proposed architecture, status model, API and function contracts. |
| `migrations/101_web_customers_and_ids.sql` | Website customers, permanent `MBM-CUS-` IDs, phone matching. |
| `migrations/102_site_cms.sql` | Site admins, draft/publish content, product display metadata. |
| `migrations/103_web_order_inbox.sql` | Order inbox, `place_web_order`, ERP conversion. Price lookup is a deliberate stub. |
| `migrations/104_stock_reservation_PROPOSAL.sql` | Reserve / deduct / release for web orders. **Changes ERP inventory logic: needs explicit approval.** |
| `migrations/105_rls_and_grants.sql` | RLS and grants, plus the verification checklist to run on dev. |

Apply order: 101, 102, 103, 105 (and 104 only if approved). Each file is one transaction.
Syntax of all five files was checked with the PostgreSQL parser (`libpg-query`); they have **not** been executed.
