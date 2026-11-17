# Phase 1 Findings (read-only investigation)

Status: **investigation only.** Nothing here was applied to any database, and no ERP file was modified.
Evidence comes from the ERP repository (`meat-bond-foods-erp`, migrations 001-026 and `src/`) and the website repository.

## 1. Is `meat-bond-erp-dev` an isolated development project?

**Not verified. Not used.**

- `supabase/.temp/linked-project.json` in the ERP repo links the CLI to a project named `meat-bond-erp-dev`.
- The ERP `.env.local` Supabase URL points at a **different** project reference. That one is treated as live/production.
- The Supabase CLI is not installed here and no connection was made to either project. Nothing can confirm whether `meat-bond-erp-dev` has its own database, separate data and separate keys.
- A project name is not evidence of isolation.

**Needed from the owner:** confirm in the Supabase dashboard that `meat-bond-erp-dev` is a separate project (own URL, own keys, test data only) **or** create a fresh dev project. Then provide its URL and anon key for the website's *development* environment. The service-role key is only needed for server-side admin tasks and must be supplied through Vercel's environment settings, never in chat.

## 2. Selling price: NO reliable source exists in the ERP

| Check | Result |
|---|---|
| `products` table (migration 001) | Columns: `code, name, category, unit, description, image_url, min_stock_level, max_stock_level, is_active`. **No price column.** |
| Later migrations (002-026) | Only `image_url` is added to `products`. No `selling_price` or `cost_price` column anywhere. |
| ERP TypeScript `Product` type | Declares optional `selling_price` and `cost_price`. They exist only in the type and in seed/demo data. |
| ERP product form (`ProductFormModal.tsx`) | Contains **no** price or cost fields. |
| Customer contract pricing | `CustomerContractPricingModal` and `customer-contract-rebate-service.ts` store contracts in **browser localStorage**, using `selling_price ?? 400` and `?? 0` fallbacks. Not persisted in the database. |
| Sales order lines | `sales_order_items.unit_price` is entered per order and is a per-order snapshot, not a price list. |

**Conclusion:** there is no authoritative, persisted selling price in the ERP. Per the instruction to keep the ERP as the price source of truth and not to invent one:

- No price column, price table or website pricing system has been created.
- `web_current_price()` in migration 103 is a deliberate stub that **raises an error**, so web orders cannot be created until a price source is approved.
- The public catalogue view shows only products whose price is non-NULL, so it stays empty until then.

**Options for approval (each needs an ERP change, so none is applied):**
- **A.** Add `products.selling_price` plus a field in the ERP product form. Simplest. One current price per product.
- **B.** Add an ERP-owned `product_selling_prices` table (effective-dated, one active price per product), managed from a new ERP screen. Recommended: it keeps price history and allows later retail-versus-wholesale lists.
- **C.** Use only the website admin to set prices. **Rejected:** it contradicts "ERP is the source of truth".

## 3. Stock reservation: the column exists but nothing uses it

- `inventory_levels` has `quantity_on_hand`, `quantity_reserved` and a generated `quantity_available = on_hand - reserved`.
- `quantity_reserved` is **never written** by any ERP function, trigger or screen. It appears only in the table definition and the TypeScript type.
- Nothing deducts stock on a sale: `sales_out` appears only in the `movement_type` enum and the TypeScript types. Only `adjust_stock()` (manual adjustment) changes inventory.
- `movement_type` has no reservation value.

**Proposal** (`migrations/104_stock_reservation_PROPOSAL.sql`, needs approval, not applied):
- A new `stock_reservations` table records each reservation, with `quantity_reserved` kept in step with it.
- Reserve on ERP confirmation, deduct (with a `sales_out` movement) on dispatch, and release on cancellation.
- **Scoped to web-originated sales orders only.** Existing ERP orders behave exactly as today. Widening it to all orders is a separate business decision.

## 4. Existing ERP order workflow (to be respected, not bypassed)

- `sales_order_status`: `draft, confirmed, processing, ready, dispatched, delivered, cancelled`.
- The `trg_workflow_sales_orders` trigger requires `sales.approve` (and the user's approval limit) to move to confirmed/processing/ready, `delivery.complete` for dispatched/delivered, and `sales.cancel` for cancelled. It is skipped only when `auth.uid()` is NULL (service role).
- `sales_orders.customer_id` is NOT NULL and `order_number` is UNIQUE.
- There is no delivery-charge, payment-method or channel column. Conversion therefore maps these into `notes`, or they require an ERP change.

**Therefore** website orders never insert into `sales_orders` directly. They enter a separate **inbox**. ERP staff convert an order, which creates a **draft** sales order, and the ERP's own approval triggers handle confirmation.

## 5. Customer authentication

- Supabase Phone OTP needs an SMS provider configured in the Supabase project. **None is known to be configured.** Provider choice and cost are the owner's decision (Bangladesh SMS gateway).
- Customers and staff would share `auth.users`. ERP policies grant access through `has_permission()` / `is_active_user()`, which require a `user_profiles` row. Customers have none, so they should be blocked from ERP tables. **This is based on the migration files and must be verified on the dev database** with `supabase/checks/015_verify_access_control.sql` before any customer can sign in there.
- Customer-facing database calls use the **customer's own session** (`auth.uid()`), so the service-role key is not needed for orders.

## 6. Website repository

Next.js 15 / TypeScript / Tailwind, the repository layer (`src/lib/repositories`), demo catalogue and order APIs with an in-memory demo store, and an `/admin` gate. No Supabase client exists yet. No keys are configured in the website's Vercel project.
