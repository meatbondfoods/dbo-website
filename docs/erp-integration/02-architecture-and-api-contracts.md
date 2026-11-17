# Architecture and API contracts (proposed)

Status: **design for review.** Nothing here is applied to a database or deployed beyond the demo.

## Architecture

```
Customer browser ──(Supabase Phone OTP session)──▶ Next.js website (Vercel)
                                                     │  server routes, customer's own JWT
                                                     ▼
                                      Shared Supabase project  (same one the ERP uses)
        ┌─────────────────────────────────────────────────────────────────────────┐
        │ web_customers / addresses   web_orders / items / events  (ORDER INBOX)   │
        │ site_content (draft+published)   product_display   web_catalog (view)    │
        └───────────────▲─────────────────────────────────────────────────────────┘
                        │ staff read inbox, call convert_web_order()
                  MeatBond Foods ERP  ──▶ creates a DRAFT sales_order ──▶ existing approval workflow
```

Principles:
1. **The ERP stays the source of truth** for products, prices, stock and sales. The website stores presentation data and the inbox only.
2. **No service-role key in the website for customer actions.** Customer operations call `SECURITY DEFINER` functions with the customer's own session (`auth.uid()`). The service-role key is reserved for narrow admin tasks, held only in Vercel server environment variables.
3. **Orders never write straight into `sales_orders`.** They enter the inbox as `pending_confirmation`. Staff convert them to a *draft* sales order, so the ERP's approval triggers still apply.
4. **Server-side truth.** The client sends product IDs and quantities only. Price, stock, totals, delivery charge and the order reference are computed in the database.
5. **Idempotent.** `(web_customer_id, idempotency_key)` is unique. A repeated submission returns the original order. Reusing a key with a different payload is rejected.
6. **Stock:** no change on order, **reserve** on ERP confirmation, **deduct** on dispatch, **release** on cancellation (migration 104, needs approval; web orders only).

## Status model

| Website status | Source |
|---|---|
| `pending_confirmation` | inbox `pending_confirmation`, or the linked ERP sales order is still `draft` |
| `confirmed`, `processing`, `ready`, `dispatched`, `delivered` | mirrored read-only from the ERP `sales_order_status` |
| `rejected` | inbox `rejected` (staff) |
| `cancelled` | inbox `cancelled_by_customer`, or ERP `cancelled` |

## Website API (Next.js routes)

All responses are `Cache-Control: no-store`. Errors are `{ "error": string, "details"? }`.

| Method and path | Auth | Purpose |
|---|---|---|
| `GET /api/catalog` | public | Published, ERP-priced products. Source: `web_catalog` view. Empty until the ERP price source is approved. |
| `GET /api/catalog/{slug}` | public | One product. |
| `POST /api/auth/otp/request` | public, rate-limited | Send a Phone OTP to a normalised BD mobile. |
| `POST /api/auth/otp/verify` | public, rate-limited | Verify the OTP and create the session (cookie). |
| `POST /api/account/register` | customer session | Calls `register_web_customer(name, email)`. Returns `{ customer_code, erp_match_status }`. |
| `GET/PATCH /api/account/profile` | customer session | Read or update `full_name`, `email` only. Code and phone are immutable. |
| `GET/POST/PATCH/DELETE /api/account/addresses` | customer session | Delivery addresses (RLS: own rows). |
| `POST /api/orders` | customer session + `Idempotency-Key` header | Calls `place_web_order`. Body: `{ delivery: {line1, area, city, notes?}, paymentMethod, lines: [{productId, quantity}] }`. Returns `201 { reference, status: "pending_confirmation", subtotal, deliveryCharge, total }`. |
| `GET /api/account/orders` | customer session | Calls `get_my_web_orders()`: own orders, items, timeline. |
| `GET /api/orders/{reference}` | customer session | One of the caller's own orders. (The demo's phone-lookup is removed once real accounts exist.) |
| `GET /api/admin/*` | **admin session + `site_admins` role** | Content, products display, orders, customers. **Disabled in production until authentication exists** (middleware returns 404). |

Order submission errors: `400` bad/missing idempotency key, `401` not signed in, `409` key reused with a different payload, `422` validation (unknown product, not enough stock, payment method not enabled), `429` rate limited, `503` while the ERP price source is not configured.

## Database functions (migrations)

| Function | Caller | Notes |
|---|---|---|
| `register_web_customer(name, email)` | customer | Phone is read from the verified auth user, never client input. Links an ERP customer only on exactly one phone match. |
| `place_web_order(key, delivery, payment, lines)` | customer | Prices from `web_current_price()` (stub that raises until approved). |
| `get_my_web_orders()` | customer | Own rows only; status mirrored from the ERP. |
| `convert_web_order(id, erp_customer?)` | ERP staff (`sales.create`) | Creates a **draft** sales order. Never confirms. |
| `reject_web_order(id, reason)` | ERP staff (`sales.cancel`) | |
| `save_site_draft` / `publish_site_content` / `rollback_site_content` | site admin (`editor` / `owner`) | Publish and rollback are owner-only and audited. |

## ERP-side changes required (need your approval, not made)
1. The migrations above, applied to a verified dev database first.
2. A **price source** in the ERP (option A or B in `01-findings.md`), plus its screen.
3. An ERP **"Web Orders" inbox screen** (list, convert, reject, link customer). The inbox is readable by ERP staff only through the new RLS policies.
4. Optionally, stock reservation (104) for web orders.

## Open questions
- Where does the delivery charge belong in the ERP? `sales_orders` has no such column (conversion currently folds it into `total_amount` and `notes`).
- `sales_orders.order_number` convention: the web reference is reused as a placeholder.
- SMS provider and cost for Phone OTP.
- Which Supabase project is the safe development target.
