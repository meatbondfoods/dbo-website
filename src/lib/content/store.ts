import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DEFAULTS } from "./defaults";
import { SCHEMAS, type ContentKey, type ContentMap } from "./schema";
import { checkTheme } from "./contrast";

/**
 * Draft / publish content store.
 *
 * DEVELOPMENT STORE: a JSON file at .data/site-content.json (git-ignored). Reading works everywhere,
 * so a deployed site simply serves the built-in defaults. WRITING is refused in production until real
 * admin authentication and the Supabase-backed store (migration 102) exist.
 */
const FILE = path.join(process.cwd(), ".data", "site-content.json");

interface Version { version: number; data: unknown; at: string }
interface Rec { draft?: unknown; published?: unknown; version: number; history: Version[] }
type Db = Partial<Record<ContentKey, Rec>>;

function load(): Db { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } }
function persist(db: Db) {
  if (process.env.NODE_ENV === "production") throw new Error("Content editing is disabled in production until admin authentication exists.");
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function parse<K extends ContentKey>(key: K, raw: unknown): ContentMap[K] | null {
  const r = SCHEMAS[key].safeParse(raw);
  return r.success ? (r.data as ContentMap[K]) : null;
}

/** Public/rendering read. `preview` (admin draft mode only) reads the draft; everything else reads PUBLISHED. */
export function getContent<K extends ContentKey>(key: K, opts: { preview?: boolean } = {}): ContentMap[K] {
  const rec = load()[key];
  const picked = opts.preview ? (rec?.draft ?? rec?.published) : rec?.published;
  return (picked !== undefined ? parse(key, picked) : null) ?? DEFAULTS[key];
}

export function getAdminState<K extends ContentKey>(key: K) {
  const rec = load()[key];
  const published = (rec?.published !== undefined ? parse(key, rec.published) : null) ?? DEFAULTS[key];
  const draft = (rec?.draft !== undefined ? parse(key, rec.draft) : null) ?? published;
  const hasDraft = rec?.draft !== undefined;
  const differs = JSON.stringify(draft) !== JSON.stringify(published);
  return { draft, published, defaults: DEFAULTS[key], hasDraft, differs, version: rec?.version ?? 0, history: (rec?.history ?? []).map(({ version, at }) => ({ version, at })).reverse() };
}

export function saveDraft<K extends ContentKey>(key: K, raw: unknown) {
  const parsed = SCHEMAS[key].safeParse(raw);
  if (!parsed.success) return { ok: false as const, errors: parsed.error.flatten() };
  const db = load();
  const rec: Rec = db[key] ?? { version: 0, history: [] };
  rec.draft = parsed.data;
  db[key] = rec;
  persist(db);
  return { ok: true as const };
}

export function publish<K extends ContentKey>(key: K) {
  const db = load();
  const rec = db[key];
  if (!rec || rec.draft === undefined) return { ok: false as const, error: "There is no draft to publish." };
  const data = parse(key, rec.draft);
  if (!data) return { ok: false as const, error: "The draft is invalid." };
  if (key === "theme") {
    const failing = checkTheme(data as ContentMap["theme"]).filter((r) => !r.pass);
    if (failing.length) return { ok: false as const, error: `Theme blocked: ${failing.map((f) => `${f.label} (${f.ratio}:1)`).join("; ")}. Text needs at least 4.5:1 contrast.` };
  }
  rec.version += 1;
  rec.published = data;
  rec.history.push({ version: rec.version, data, at: new Date().toISOString() });
  rec.history = rec.history.slice(-20);
  delete rec.draft;
  persist(db);
  return { ok: true as const, version: rec.version };
}

export function rollback<K extends ContentKey>(key: K, version: number) {
  const rec = load()[key];
  const v = rec?.history.find((h) => h.version === version);
  if (!rec || !v) return { ok: false as const, error: "Version not found." };
  const saved = saveDraft(key, v.data);
  if (!saved.ok) return { ok: false as const, error: "That version is no longer valid." };
  return publish(key);
}

export function discardDraft(key: ContentKey) {
  const db = load();
  if (db[key]) { delete db[key]!.draft; persist(db); }
}
