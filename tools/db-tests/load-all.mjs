import fs from "node:fs";
import { ERP_DIR, MY_DIR, freshDb, listSql } from "./db.mjs";

// In-memory repair of three typos in the ERP repo (`$;` should be `$$;`). The ERP files themselves are NOT modified.
const FIXES = new Set(["022_governance_foundation.sql", "026_governance_investors_exits_compliance.sql"]);
// closers "$;" -> "$$;"  and openers "AS $<newline>" -> "AS $$<newline>"
const repair = (name, sql) => (FIXES.has(name)
  ? sql.replace(/(^|[^$])\$;/gm, (_, a) => `${a}$$;`).replace(/AS \$(\r?\n)/g, (_, nl) => `AS $$${nl}`)
  : sql);

export async function loadAll({ withMine = true, verbose = true } = {}) {
  const db = await freshDb();
  const results = [];
  const run = async (dir, f, transform = (_, s) => s) => {
    const sql = transform(f, fs.readFileSync(`${dir}/${f}`, "utf8"));
    try { await db.exec(sql); results.push({ file: f, ok: true }); }
    catch (e) { results.push({ file: f, ok: false, error: String(e.message ?? e).split("\n")[0] }); try { await db.exec("ROLLBACK"); } catch {} }
  };
  for (const f of listSql(ERP_DIR)) await run(ERP_DIR, f, repair);
  if (withMine) for (const f of ["101_web_customers_and_ids.sql", "102_site_cms.sql", "103_web_order_inbox.sql", "104_stock_reservation_PROPOSAL.sql", "105_rls_and_grants.sql", "106_storage_and_admin.sql"]) await run(MY_DIR, f);
  if (verbose) for (const r of results) console.log(`${r.ok ? "OK  " : "FAIL"} ${r.file}${r.ok ? "" : "  -> " + r.error}`);
  return { db, results };
}

if (process.argv[1].endsWith("load-all.mjs")) {
  const { db, results } = await loadAll();
  const t = await db.query("select count(*)::int as n from information_schema.tables where table_schema='public'");
  console.log(`\npublic tables: ${t.rows[0].n}; failed files: ${results.filter((r) => !r.ok).length}`);
}
