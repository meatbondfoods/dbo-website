// Throw-away in-memory PostgreSQL that imitates a Supabase project, so migrations can be EXECUTED, not just parsed.
// Nothing here touches Supabase or any real database. ERP migration files are only READ.
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { uuid_ossp } from "@electric-sql/pglite/contrib/uuid_ossp";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

import { fileURLToPath } from "node:url";
// Where the ERP repository lives (read-only). Override with the ERP_REPO environment variable.
export const ERP_DIR = (process.env.ERP_REPO ?? "D:/MeatBond Foods") + "/supabase/migrations";
export const MY_DIR = fileURLToPath(new URL("../../docs/erp-integration/migrations", import.meta.url));

// The platform pieces Supabase provides that the migrations rely on.
const PLATFORM = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE authenticator NOLOGIN;
GRANT anon, authenticated, service_role TO authenticator;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS extensions; CREATE SCHEMA auth; CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA public, auth, storage, extensions TO anon, authenticated, service_role;

CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email TEXT UNIQUE, phone TEXT, encrypted_password TEXT,
  email_confirmed_at TIMESTAMPTZ, phone_confirmed_at TIMESTAMPTZ, last_sign_in_at TIMESTAMPTZ,
  raw_app_meta_data JSONB DEFAULT '{}'::JSONB, raw_user_meta_data JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
                  NULLIF(current_setting('request.jwt.claims', true), '')::JSONB ->> 'sub')::UUID $$;
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
                  NULLIF(current_setting('request.jwt.claims', true), '')::JSONB ->> 'role') $$;
CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::JSONB, '{}'::JSONB) $$;
GRANT SELECT ON auth.users TO service_role;

CREATE TABLE storage.buckets (id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT FALSE, file_size_limit BIGINT, allowed_mime_types TEXT[], created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT REFERENCES storage.buckets(id), name TEXT, owner UUID, metadata JSONB, created_at TIMESTAMPTZ DEFAULT now());
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array(name, '/') $$;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO authenticated, anon, service_role;
-- Supabase gives its API roles default privileges on everything created later in public.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`;

export async function freshDb() {
  const db = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
  await db.exec(PLATFORM);
  return db;
}

/** Run files in order. Returns [{file, ok, error?}]. Stops at the first failure unless keepGoing. */
export async function runFiles(db, dir, files, { keepGoing = false } = {}) {
  const out = [];
  for (const f of files) {
    const sql = fs.readFileSync(`${dir}/${f}`, "utf8");
    try { await db.exec(sql); out.push({ file: f, ok: true }); }
    catch (e) {
      out.push({ file: f, ok: false, error: String(e.message ?? e).split("\n")[0] });
      try { await db.exec("ROLLBACK"); } catch { /* not in a transaction */ }
      if (!keepGoing) break;
    }
  }
  return out;
}
export const listSql = (dir) => fs.readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();

/** Act as a user, the way Supabase's API does: set the JWT claims and switch role. */
export async function asUser(db, uid, role = "authenticated") {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claims', '${JSON.stringify({ sub: uid, role })}', false);`);
  await db.exec(`SET ROLE ${role}`);
}
export async function asAnon(db) { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claims', '', false); SET ROLE anon`); }
export async function asAdminRole(db) { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claims', '', false);`); }
