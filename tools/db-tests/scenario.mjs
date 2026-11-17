process.on("uncaughtException", (e) => { console.log("CRASH: " + String(e.message).split("\n")[0]); process.exit(2); });
import { loadAll } from "./load-all.mjs";
import { asUser, asAnon, asAdminRole } from "./db.mjs";

const { db, results } = await loadAll({ verbose: false });
let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra !== "" ? "  -> " + String(extra).slice(0, 140) : ""}`); };
const q = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await q(sql, params))[0];
/** Run a statement expecting it to be refused (error). Returns the message, or null if it unexpectedly succeeded. */
const refused = async (sql, params) => { try { await db.query(sql, params); return null; } catch (e) { try { await db.exec("ROLLBACK"); } catch {} return String(e.message); } };

ok("Schema loads: ERP 001-026 (3 typos repaired in memory) + website 101-106, no failures", results.every((r) => r.ok), results.filter((r) => !r.ok).map((r) => r.file).join(","));

// ---------------------------------------------------------------- setup (as database owner)
const U = { super: "00000000-0000-0000-0000-0000000000a1", erpViewer: "00000000-0000-0000-0000-0000000000a2", editor: "00000000-0000-0000-0000-0000000000a3",
            custA: "00000000-0000-0000-0000-0000000000b1", custB: "00000000-0000-0000-0000-0000000000b2", custU: "00000000-0000-0000-0000-0000000000b3", ghost: "00000000-0000-0000-0000-0000000000b4" };
await asAdminRole(db);
const mk = (id, email, verified = true, meta = {}) => db.query(`INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES ($1,$2,${verified ? "now()" : "NULL"},$3)`, [id, email, JSON.stringify(meta)]);
await mk(U.super, "boss@erp.test"); await mk(U.erpViewer, "viewer@erp.test"); await mk(U.editor, "editor@mart.test");
await mk(U.custA, "alice@shop.test"); await mk(U.custB, "bob@shop.test"); await mk(U.custU, "unverified@shop.test", false); await mk(U.ghost, "ghost@shop.test");
await db.query(`INSERT INTO user_profiles (id, email, full_name, role, is_active) VALUES ($1,'boss@erp.test','ERP Boss','super_admin',true), ($2,'viewer@erp.test','ERP Viewer','viewer',true)`, [U.super, U.erpViewer]);
await db.query(`INSERT INTO site_admins (user_id, role) VALUES ($1,'editor')`, [U.editor]);
// ERP data that customers must never reach
const prod = await one(`INSERT INTO products (code, name, category, unit) VALUES ('P-001','Whole Broiler','raw_meat','kg') RETURNING id`);
await db.query(`INSERT INTO inventory_levels (product_id, quantity_on_hand) VALUES ($1, 50)`, [prod.id]);
const erpCust = await one(`INSERT INTO customers (code, name, phone) VALUES ('C-001','Existing ERP Customer','01711111111') RETURNING id`);
await db.query(`INSERT INTO suppliers (code, name, phone) VALUES ('S-001','Secret Supplier','01822222222')`).catch(() => {});

// ---------------------------------------------------------------- 1. who is a website admin?
const role = async (uid) => { await asUser(db, uid); const r = (await one(`SELECT public.site_admin_role() AS r`)).r; await asAdminRole(db); return r; };
ok("ERP super admin is a website OWNER (via the ERP's is_super_admin)", (await role(U.super)) === "owner");
ok("An ordinary ERP user (viewer) is NOT a website admin", (await role(U.erpViewer)) === null);
ok("A site_admins editor is an editor", (await role(U.editor)) === "editor");
ok("A website customer is NOT an admin", (await role(U.custA)) === null);
await db.query(`UPDATE user_profiles SET is_active = false WHERE id = $1`, [U.super]);
ok("Deactivating the super admin in the ERP removes website-owner access at once", (await role(U.super)) === null);
await db.query(`UPDATE user_profiles SET is_active = true WHERE id = $1`, [U.super]);
ok("Reactivating restores it", (await role(U.super)) === "owner");
await asAnon(db);
ok("Anonymous visitors cannot call site_admin_role()", (await refused(`SELECT public.site_admin_role()`)) !== null);
await asAdminRole(db);

// ---------------------------------------------------------------- 2. customer IDs
await asUser(db, U.custU);
ok("Unverified email cannot become a customer (no ID issued)", /Verify your email/i.test((await refused(`SELECT * FROM public.register_web_customer('Una Verified')`)) ?? ""));
await asUser(db, U.custA);
const a1 = await one(`SELECT * FROM public.register_web_customer('Alice Rahman', '01712345678')`);
const a2 = await one(`SELECT * FROM public.register_web_customer('Different Name', '01999999999')`);
ok("First verified customer gets MBM-CUS-000001", a1.customer_code === "MBM-CUS-000001", a1.customer_code);
ok("Registering again is idempotent (same ID, original name kept)", a2.customer_code === a1.customer_code && a2.full_name === "Alice Rahman");
ok("Phone is normalised to E.164", a1.phone === "+8801712345678", a1.phone);
await asUser(db, U.custB);
const b1 = await one(`SELECT * FROM public.register_web_customer('Bob Karim')`);
ok("Second customer gets the next ID MBM-CUS-000002", b1.customer_code === "MBM-CUS-000002", b1.customer_code);
await asAnon(db);
ok("Anonymous visitors cannot register a customer", (await refused(`SELECT * FROM public.register_web_customer('X Y')`)) !== null);
await asAdminRole(db);
const rowA = await one(`SELECT id, customer_code FROM web_customers WHERE auth_user_id = $1`, [U.custA]);
ok("The Customer ID is separate from the auth user id", rowA.customer_code !== U.custA && rowA.id !== U.custA);

// ---------------------------------------------------------------- 3. immutability + own-row access
await asUser(db, U.custA);
ok("Customer can read exactly their own row", (await q(`SELECT 1 FROM web_customers`)).length === 1);
ok("Customer cannot change their Customer ID", (await refused(`UPDATE web_customers SET customer_code = 'MBM-CUS-999999'`)) !== null);
ok("Customer cannot change their auth link", (await refused(`UPDATE web_customers SET auth_user_id = gen_random_uuid()`)) !== null);
ok("Customer cannot link themselves to an ERP customer", (await refused(`UPDATE web_customers SET erp_customer_id = '${erpCust.id}'`)) !== null);
ok("Customer cannot edit the email or verification fields", (await refused(`UPDATE web_customers SET email = 'x@y.z'`)) !== null && (await refused(`UPDATE web_customers SET email_verified_at = now()`)) !== null);
await refused(`DELETE FROM web_customers`);
ok("Customer cannot delete their record (codes are never reissued)", (await q(`SELECT 1 FROM web_customers`)).length === 1);
await asAdminRole(db);
ok("Even the database owner cannot delete a customer (trigger)", /never deleted/i.test((await refused(`DELETE FROM web_customers`)) ?? ""));
await asUser(db, U.custA);
await db.query(`UPDATE web_customers SET full_name = 'Alice R. Rahman', phone = '+8801712345678'`);
ok("Customer CAN edit their name and phone", (await one(`SELECT full_name FROM web_customers`)).full_name === "Alice R. Rahman");
ok("A bad phone is rejected by the database", (await refused(`UPDATE web_customers SET phone = '12345'`)) !== null);

// ---------------------------------------------------------------- 4. addresses
const addr = (line, def = false) => db.query(`INSERT INTO web_customer_addresses (web_customer_id, full_name, phone, line1, area, city, is_default) SELECT id, 'Alice', '+8801712345678', $1, 'Gulshan', 'Dhaka', $2 FROM web_customers`, [line, def]);
await addr("House 5, Road 3"); await addr("Flat 9B, Lake View", true);
const defs = await q(`SELECT line1, is_default FROM web_customer_addresses ORDER BY created_at`);
ok("First address became default; marking another default moved it (only one default)", defs.filter((d) => d.is_default).length === 1 && defs.find((d) => d.is_default).line1 === "Flat 9B, Lake View", JSON.stringify(defs));
ok("A malformed address is rejected (short line, bad phone)", (await refused(`INSERT INTO web_customer_addresses (web_customer_id, full_name, phone, line1, area) SELECT id,'A B','123','x','G' FROM web_customers`)) !== null);
for (let i = 0; i < 8; i++) await addr(`Extra address ${i + 1} street`);
ok("A customer can save at most 10 addresses", /up to 10/i.test((await refused(`INSERT INTO web_customer_addresses (web_customer_id, full_name, phone, line1, area) SELECT id,'Alice','+8801712345678','One too many','Gulshan' FROM web_customers`)) ?? ""));
await asUser(db, U.custB);
await db.query(`INSERT INTO web_customer_addresses (web_customer_id, full_name, phone, line1, area) SELECT id,'Bob','+8801811111111','Bob own street 1','Banani' FROM web_customers`);
ok("Bob sees only his own address, not Alice's 10", (await q(`SELECT 1 FROM web_customer_addresses`)).length === 1);
const aliceAddrId = await (async () => { await asAdminRole(db); return (await one(`SELECT id FROM web_customer_addresses WHERE line1 = 'House 5, Road 3'`)).id; })();
await asUser(db, U.custB);
await db.query(`UPDATE web_customer_addresses SET line1 = 'HIJACKED ADDRESS' WHERE id = $1`, [aliceAddrId]);
await db.query(`DELETE FROM web_customer_addresses WHERE id = $1`, [aliceAddrId]);
await db.query(`INSERT INTO web_customer_addresses (web_customer_id, full_name, phone, line1, area) VALUES ((SELECT web_customer_id FROM web_customer_addresses LIMIT 1), 'X Y', '+8801811111111', 'Inject into other', 'Z Z')`).catch(() => {});
await asAdminRole(db);
const still = await one(`SELECT line1 FROM web_customer_addresses WHERE id = $1`, [aliceAddrId]);
ok("Bob's UPDATE / DELETE of Alice's address changed nothing (RLS)", still?.line1 === "House 5, Road 3", still?.line1);
await asUser(db, U.custB);
ok("Bob cannot create an address under Alice's customer id", (await refused(`INSERT INTO web_customer_addresses (web_customer_id, full_name, phone, line1, area) SELECT id, 'Mallory', '+8801811111111', 'Planted address', 'Z Z' FROM web_customers WHERE auth_user_id <> auth.uid()`)) !== null || (await q(`SELECT 1 FROM web_customers WHERE auth_user_id <> auth.uid()`)).length === 0);
await asAdminRole(db);

// ---------------------------------------------------------------- 5. customers cannot reach ERP data
await asUser(db, U.custA);
const erpTables = ["products", "customers", "sales_orders", "sales_order_items", "inventory_levels", "stock_movements", "suppliers", "purchase_orders", "accounts", "journal_entries", "employees", "salary_slips", "user_profiles", "audit_logs", "customer_invoices", "payments", "founders", "investors"];
const leaks = [];
for (const t of erpTables) { try { const n = (await one(`SELECT count(*)::int AS n FROM public.${t}`)).n; if (n > 0) leaks.push(`${t}:${n}`); } catch { try { await db.exec("ROLLBACK"); } catch {} } }
ok(`A signed-in CUSTOMER sees 0 rows in ${erpTables.length} ERP tables (products, customers, suppliers, accounting, HR, governance...)`, leaks.length === 0, leaks.join(","));
await asAnon(db);
const leaks2 = [];
for (const t of [...erpTables, "web_customers", "web_customer_addresses", "web_orders", "web_order_items", "web_order_events", "site_admins", "site_audit_log", "product_display"]) { try { const n = (await one(`SELECT count(*)::int AS n FROM public.${t}`)).n; if (n > 0) leaks2.push(`${t}:${n}`); } catch { try { await db.exec("ROLLBACK"); } catch {} } }
ok("An ANONYMOUS visitor sees nothing in ERP or private website tables", leaks2.length === 0, leaks2.join(","));
await asAdminRole(db);

// ---------------------------------------------------------------- 6. CMS (draft / publish / roles)
await asUser(db, U.custA);
ok("A customer cannot save website content", (await refused(`SELECT public.save_site_draft('hero','{"a":1}')`)) !== null);
ok("A customer cannot make themselves an admin", (await refused(`INSERT INTO site_admins (user_id, role) VALUES (auth.uid(), 'owner')`)) !== null);
await asUser(db, U.erpViewer);
ok("An ordinary ERP user cannot save website content", (await refused(`SELECT public.save_site_draft('hero','{"a":1}')`)) !== null);
await asUser(db, U.editor);
await db.query(`SELECT public.save_site_draft('hero', '{"headline":"Draft one"}')`);
ok("An editor can save a draft", (await one(`SELECT data->>'headline' AS h FROM site_content WHERE key='hero' AND status='draft'`)).h === "Draft one");
ok("An editor cannot publish (owner only)", /Only an owner/i.test((await refused(`SELECT public.publish_site_content('hero')`)) ?? ""));
await asAnon(db);
ok("Anonymous visitors cannot see DRAFT content", (await q(`SELECT 1 FROM site_content WHERE status='draft'`)).length === 0);
await asUser(db, U.super);
const ver = await one(`SELECT public.publish_site_content('hero') AS v`);
ok("The ERP super admin (owner) can publish -> version 1", ver.v === 1, ver.v);
await db.query(`SELECT public.save_site_draft('hero', '{"headline":"Draft two"}')`); await db.query(`SELECT public.publish_site_content('hero')`);
await db.query(`SELECT public.rollback_site_content('hero', 1)`);
await asAnon(db);
ok("After a rollback, visitors see the version-1 content", (await one(`SELECT data->>'headline' AS h FROM site_content WHERE key='hero' AND status='published'`)).h === "Draft one");
await asUser(db, U.super);
ok("The audit log records saves / publishes / rollback", (await one(`SELECT count(*)::int AS n FROM site_audit_log`)).n >= 5);
await refused(`UPDATE site_audit_log SET action='x'`); await refused(`DELETE FROM site_audit_log`);
ok("Not even the owner can alter or delete audit entries through the API", (await one(`SELECT count(*)::int AS n FROM site_audit_log WHERE action='x'`)).n === 0 && (await one(`SELECT count(*)::int AS n FROM site_audit_log`)).n >= 5);
await asAdminRole(db);
ok("The audit log is append-only even for the database owner (trigger)", /append-only/i.test((await refused(`UPDATE site_audit_log SET action='x'`)) ?? "") && /append-only/i.test((await refused(`DELETE FROM site_audit_log`)) ?? ""));

// ---------------------------------------------------------------- 7. orders: inbox, price gate, idempotency
await db.query(`INSERT INTO web_categories (slug, name) VALUES ('chicken','Chicken')`);
await db.query(`INSERT INTO product_display (product_id, visible, slug, category_slug) VALUES ($1, true, 'whole-broiler', 'chicken')`, [prod.id]);
const catalogBefore = await (async () => { await asAnon(db); const r = await q(`SELECT * FROM web_catalog`); await asAdminRole(db); return r; })();
ok("Public catalogue is EMPTY while the ERP has no selling-price source (nothing invented)", catalogBefore.length === 0);
await asUser(db, U.custA);
ok("Ordering is BLOCKED while no ERP price source exists", /selling-price source is not configured/i.test((await refused(`SELECT * FROM public.place_web_order('aaaaaaaaaaaaaaaa-0001', '{"line1":"House 5 Road 3","area":"Gulshan"}'::jsonb, 'cod', $1::jsonb)`, [JSON.stringify([{ product_id: prod.id, quantity: 2 }])])) ?? ""));
await asAdminRole(db);
// Simulate the future, approved ERP price source for the test only (NOT part of any migration).
await db.exec(`CREATE TABLE IF NOT EXISTS pg_temp.test_prices (product_id UUID PRIMARY KEY, price NUMERIC); `).catch(() => {});
await db.exec(`CREATE TABLE public.test_prices (product_id UUID PRIMARY KEY, price NUMERIC)`);
await db.query(`INSERT INTO public.test_prices VALUES ($1, 340)`, [prod.id]);
await db.exec(`CREATE OR REPLACE FUNCTION public.web_current_price(p_product_id UUID) RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT price FROM public.test_prices WHERE product_id = p_product_id $$;`);
await asAnon(db);
const cat = await q(`SELECT slug, price, availability FROM web_catalog`);
ok("Once a price source exists, the public catalogue shows the product with price + availability only", cat.length === 1 && Number(cat[0].price) === 340 && cat[0].availability === "in_stock" && !("quantity_available" in cat[0]), JSON.stringify(cat[0]));
await asAdminRole(db);

const place = (key, lines, pay = "cod", delivery = '{"line1":"House 5 Road 3","area":"Gulshan","city":"Dhaka"}') => one(`SELECT * FROM public.place_web_order($1, $2::jsonb, $3, $4::jsonb)`, [key, delivery, pay, JSON.stringify(lines)]);
await asUser(db, U.custA);
const o1 = await place("order-key-aaaaaaaa-0001", [{ product_id: prod.id, quantity: 2 }]);
ok("Order is created as PENDING CONFIRMATION with a reference MBM-ORD-<year>-000001", o1.status === "pending_confirmation" && /^MBM-ORD-\d{4}-000001$/.test(o1.order_ref), `${o1.order_ref} ${o1.status}`);
ok("Server computed the total from the ERP price (2 x 340 = 680); client never supplies a price", Number(o1.subtotal) === 680 && Number(o1.total) === 680, `${o1.subtotal}/${o1.total}`);
ok("Delivery charge is 0 and 'to be confirmed' (policy not approved, nothing assumed)", Number(o1.delivery_charge) === 0 && (await (async () => { await asAdminRole(db); const r = (await one(`SELECT delivery_status AS s FROM web_orders WHERE order_ref = $1`, [o1.order_ref])).s; await asUser(db, U.custA); return r; })()) === "to_be_confirmed");
const o1b = await place("order-key-aaaaaaaa-0001", [{ product_id: prod.id, quantity: 2 }]);
ok("Same idempotency key + same order returns the ORIGINAL order (no duplicate)", o1b.order_ref === o1.order_ref);
ok("Same key with a DIFFERENT order is refused", /already used for a different order/i.test((await refused(`SELECT * FROM public.place_web_order('order-key-aaaaaaaa-0001', '{"line1":"House 5 Road 3","area":"Gulshan"}'::jsonb, 'cod', $1::jsonb)`, [JSON.stringify([{ product_id: prod.id, quantity: 9 }])])) ?? ""));
ok("Online payment methods are refused (only configured methods; COD)", /not enabled/i.test((await refused(`SELECT * FROM public.place_web_order('order-key-aaaaaaaa-0002', '{"line1":"House 5 Road 3","area":"Gulshan"}'::jsonb, 'bkash', $1::jsonb)`, [JSON.stringify([{ product_id: prod.id, quantity: 1 }])])) ?? ""));
ok("Ordering more than the available stock is refused", /Not enough stock/i.test((await refused(`SELECT * FROM public.place_web_order('order-key-aaaaaaaa-0003', '{"line1":"House 5 Road 3","area":"Gulshan"}'::jsonb, 'cod', $1::jsonb)`, [JSON.stringify([{ product_id: prod.id, quantity: 500 }])])) ?? ""));
ok("An unknown product is refused", (await refused(`SELECT * FROM public.place_web_order('order-key-aaaaaaaa-0004', '{"line1":"House 5 Road 3","area":"Gulshan"}'::jsonb, 'cod', $1::jsonb)`, [JSON.stringify([{ product_id: U.ghost, quantity: 1 }])])) !== null);
await asUser(db, U.ghost);
ok("A signed-in user who is not a website customer cannot place orders", (await refused(`SELECT * FROM public.place_web_order('order-key-aaaaaaaa-0005', '{"line1":"x"}'::jsonb, 'cod', $1::jsonb)`, [JSON.stringify([{ product_id: prod.id, quantity: 1 }])])) !== null);
await asAdminRole(db);
ok("Placing an order did NOT change stock (no deduction, no reservation)", Number((await one(`SELECT quantity_on_hand AS h, quantity_reserved AS r FROM inventory_levels WHERE product_id=$1`, [prod.id])).r) === 0 && Number((await one(`SELECT quantity_on_hand AS h FROM inventory_levels WHERE product_id=$1`, [prod.id])).h) === 50);
ok("A 'submitted' event was written to the timeline", (await one(`SELECT count(*)::int AS n FROM web_order_events WHERE event_type='submitted'`)).n === 1);
await asUser(db, U.custA);
const mine = await q(`SELECT * FROM public.get_my_web_orders()`);
ok("Alice sees her order with items and timeline via get_my_web_orders()", mine.length === 1 && mine[0].display_status === "pending_confirmation" && mine[0].items.length === 1 && mine[0].timeline.length === 1);
ok("Alice cannot read the inbox tables directly (0 rows, no ERP permission)", (await q(`SELECT * FROM web_orders`)).length === 0 && (await q(`SELECT * FROM web_order_items`)).length === 0);
ok("Alice cannot insert or change inbox rows", (await refused(`INSERT INTO web_orders (order_ref) VALUES ('x')`)) !== null && (await refused(`UPDATE web_orders SET total = 0`)) !== null);
await asAdminRole(db);
await asUser(db, U.super);
ok("ERP staff (super admin) CAN read the inbox", (await q(`SELECT 1 FROM web_orders`)).length >= 1);
await asUser(db, U.custA);
await asUser(db, U.custB);
ok("Bob sees NONE of Alice's orders", (await q(`SELECT * FROM public.get_my_web_orders()`)).length === 0);
ok("Bob cannot convert or reject an order (ERP permission required)", (await refused(`SELECT public.convert_web_order((SELECT id FROM (SELECT id FROM web_orders) x LIMIT 1))`)) !== null);
await asAdminRole(db);

// ---------------------------------------------------------------- 8. ERP staff: convert to a DRAFT sales order, then stock workflow
await asUser(db, U.super);
const wo = await one(`SELECT id FROM web_orders WHERE order_ref = $1`, [o1.order_ref]);
ok("ERP staff cannot convert without choosing/creating the ERP customer first", /Link or create the ERP customer/i.test((await refused(`SELECT public.convert_web_order($1)`, [wo.id])) ?? ""));
const soId = (await one(`SELECT public.convert_web_order($1, $2) AS id`, [wo.id, erpCust.id])).id;
const so = await one(`SELECT status, order_number, total_amount FROM sales_orders WHERE id = $1`, [soId]);
ok("Conversion creates a DRAFT ERP sales order (the ERP's own workflow still decides confirmation)", so.status === "draft" && so.order_number === o1.order_ref && Number(so.total_amount) === 680, JSON.stringify(so));
ok("The sales order has the web order's items at the verified price", (await one(`SELECT quantity, unit_price FROM sales_order_items WHERE sales_order_id=$1`, [soId])).unit_price == 340);
ok("The inbox order is marked accepted and linked to the sales order", (await one(`SELECT status, erp_sales_order_id AS s FROM web_orders WHERE id=$1`, [wo.id])).s === soId);
ok("A converted order cannot be converted twice", (await refused(`SELECT public.convert_web_order($1, $2)`, [wo.id, erpCust.id])) !== null);
await asUser(db, U.custA);
ok("The customer still sees 'pending confirmation' while the ERP order is only a draft", (await one(`SELECT display_status AS s FROM public.get_my_web_orders()`)).s === "pending_confirmation");
await asUser(db, U.super);
const inv = async () => one(`SELECT quantity_on_hand::float AS onh, quantity_reserved::float AS res, quantity_available::float AS av FROM inventory_levels WHERE product_id=$1`, [prod.id]);
await db.query(`UPDATE sales_orders SET status = 'confirmed' WHERE id = $1`, [soId]);
let s = await inv();
ok("ERP CONFIRMS -> stock is RESERVED (reserved 2, on hand 50, available 48)", s.res === 2 && s.onh === 50 && s.av === 48, JSON.stringify(s));
await db.query(`UPDATE sales_orders SET status = 'confirmed' WHERE id = $1`, [soId]).catch(() => {});
ok("Re-confirming does not reserve twice", (await inv()).res === 2);
await asUser(db, U.custA);
ok("The customer now sees 'confirmed' (mirrored from the ERP)", (await one(`SELECT display_status AS s FROM public.get_my_web_orders()`)).s === "confirmed");
await asUser(db, U.super);
await db.query(`UPDATE sales_orders SET status = 'dispatched' WHERE id = $1`, [soId]);
s = await inv();
ok("ERP DISPATCHES -> stock is DEDUCTED (on hand 48, reserved 0)", s.onh === 48 && s.res === 0, JSON.stringify(s));
const mv = await one(`SELECT movement_type::text AS t, quantity::float AS q, reference_type AS rt FROM stock_movements WHERE reference_id = $1`, [soId]);
ok("A 'sales_out' stock movement of 2 was recorded against the order", mv?.t === "sales_out" && mv.q === 2 && mv.rt === "sales_order", JSON.stringify(mv));
// second order: confirm then cancel -> release
await asUser(db, U.custA);
const o2 = await place("order-key-aaaaaaaa-0010", [{ product_id: prod.id, quantity: 5 }]);
await asUser(db, U.super);
const so2 = (await one(`SELECT public.convert_web_order((SELECT id FROM web_orders WHERE order_ref=$1), $2) AS id`, [o2.order_ref, erpCust.id])).id;
await db.query(`UPDATE sales_orders SET status='confirmed' WHERE id=$1`, [so2]);
ok("Second order confirmed -> 5 reserved", (await inv()).res === 5);
await db.query(`UPDATE sales_orders SET status='cancelled' WHERE id=$1`, [so2]);
s = await inv();
ok("ERP CANCELS -> reservation RELEASED (reserved 0, on hand unchanged 48)", s.res === 0 && s.onh === 48, JSON.stringify(s));
// scope: an ordinary (non-web) ERP sales order is untouched by the new stock triggers
const plain = (await one(`INSERT INTO sales_orders (order_number, customer_id, status) VALUES ('SO-PLAIN-1', $1, 'draft') RETURNING id`, [erpCust.id])).id;
await db.query(`INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price) VALUES ($1,$2,10,300)`, [plain, prod.id]);
await db.query(`UPDATE sales_orders SET status='confirmed' WHERE id=$1`, [plain]);
await db.query(`UPDATE sales_orders SET status='dispatched' WHERE id=$1`, [plain]);
ok("Existing ERP (non-web) sales orders behave EXACTLY as before: no reservation, no deduction", (await inv()).onh === 48 && (await inv()).res === 0);
// reservation cannot oversell
await asUser(db, U.custA);
await db.query(`UPDATE inventory_levels SET quantity_on_hand = quantity_on_hand`).catch(() => {});
await asAdminRole(db);
await db.query(`UPDATE inventory_levels SET quantity_on_hand = 3 WHERE product_id=$1`, [prod.id]);
await asUser(db, U.custA);
const o3 = await place("order-key-aaaaaaaa-0020", [{ product_id: prod.id, quantity: 3 }]);
await asAdminRole(db);
await db.query(`UPDATE inventory_levels SET quantity_on_hand = 1 WHERE product_id=$1`, [prod.id]);   // stock vanished before ERP confirmed
await asUser(db, U.super);
const so3 = (await one(`SELECT public.convert_web_order((SELECT id FROM web_orders WHERE order_ref=$1), $2) AS id`, [o3.order_ref, erpCust.id])).id;
ok("ERP cannot confirm an order when stock is no longer available (no overselling)", /Insufficient available stock/i.test((await refused(`UPDATE sales_orders SET status='confirmed' WHERE id=$1`, [so3])) ?? ""));
await asAdminRole(db);

// ---------------------------------------------------------------- 9. storage bucket policies
ok("Storage bucket 'site-media' exists, public, 2 MB, images only", await (async () => { const b = await one(`SELECT public, file_size_limit::int AS l, allowed_mime_types AS m FROM storage.buckets WHERE id='site-media'`); return b.public && b.l === 2097152 && b.m.join() === "image/png,image/jpeg,image/webp"; })());
const insertObj = (uid) => (async () => { await asUser(db, uid); const e = await refused(`INSERT INTO storage.objects (bucket_id, name) VALUES ('site-media', 'hero.png')`); await asAdminRole(db); return e; })();
ok("A customer cannot upload to site-media", (await insertObj(U.custA)) !== null);
ok("An ordinary ERP user cannot upload to site-media", (await insertObj(U.erpViewer)) !== null);
ok("A website editor can upload", (await insertObj(U.editor)) === null);
ok("The ERP super admin can upload", (await insertObj(U.super)) === null);
await asAnon(db);
ok("Anyone can READ site-media (it is public site imagery)", (await q(`SELECT 1 FROM storage.objects WHERE bucket_id='site-media'`)).length >= 1);
await asAdminRole(db);

ok("Internal helper functions are not callable by customers or anonymous users", await (async () => { await asUser(db, U.custA); const a = await refused(`SELECT public.next_web_order_ref()`); const b = await refused(`SELECT public.web_current_price('${prod.id}')`); await asAnon(db); const c = await refused(`SELECT public.next_web_order_ref()`); await asAdminRole(db); return a !== null && b !== null && c !== null; })());
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
