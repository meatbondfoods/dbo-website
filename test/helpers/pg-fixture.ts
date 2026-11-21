/** Real PostgreSQL (PGlite, in-process) with the website's real migrations on a minimal Supabase stand-in. */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";

const root = fileURLToPath(new URL("../..", import.meta.url));
export const mig = (f: string) => readFileSync(join(root, "supabase/migrations", f), "utf8");

/** The website's migrations, in order. Nothing outside this project is needed. */
export const WEBSITE_CHAIN = [
  "101_web_customers.sql",
  "103_website_order_inbox.sql",
  "104_catalog_projection.sql",
  "105_order_dispatch_queue.sql",
  "106_customer_tables_rls.sql",
];

/** An empty database shaped like a hosted Supabase project (API roles + the auth schema). */
export async function emptyWebsiteDb(): Promise<PGlite> {
  const db = new PGlite({ extensions: { pgcrypto, uuid_ossp } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('test.role', true), ''), 'anon') $$;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  return db;
}

export async function websiteDb(): Promise<PGlite> {
  const db = await emptyWebsiteDb();
  for (const f of WEBSITE_CHAIN) await db.exec(mig(f));
  return db;
}
