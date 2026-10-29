import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Bookmark {
  id: number;
  title: string;
  url: string;
  /** Comma-free tag names. */
  tags: string[];
  createdAt: number;
}
export interface BookmarkInput {
  title: string;
  url: string;
  tags: string[];
}
export interface ListOptions {
  q?: string;
  tag?: string;
  /** Keyset cursor: only rows with `id` below it (newest first). */
  before?: number;
  limit?: number;
}
export interface Page {
  items: Bookmark[];
  /** Pass as `before` for the next page; `null` on the last. */
  next: number | null;
}

/** Opens (creating directories) a database with WAL, foreign keys and the pending migrations applied. */
export function openDb(path: string, migrations = join(process.cwd(), "migrations")): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db, migrations);
  return db;
}

export function migrate(db: DatabaseSync, dir: string): string[] {
  db.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
  const done = new Set((db.prepare("SELECT name FROM _migrations").all() as { name: string }[]).map((r) => r.name));
  const applied: string[] = [];
  for (const name of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (done.has(name)) continue;
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(join(dir, name), "utf8"));
      db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(name, Date.now());
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    applied.push(name);
  }
  return applied;
}

const packTags = (tags: string[]) => (tags.length ? `,${tags.join(",")},` : "");
const splitTags = (s: string) => s.split(",").filter(Boolean);
type Row = { id: number; title: string; url: string; tags: string; created_at: number };
const toBookmark = (r: Row): Bookmark => ({ id: r.id, title: r.title, url: r.url, tags: splitTags(r.tags), createdAt: r.created_at });

/** Trims, lowercases, drops commas and duplicates. */
export function normalizeTags(raw: string | string[]): string[] {
  const list = Array.isArray(raw) ? raw : raw.split(/[\s,]+/);
  return [...new Set(list.map((t) => t.trim().toLowerCase().replace(/[,%_]/g, "")).filter(Boolean))].slice(0, 8);
}

/** Validates a form / JSON body; returns the input or field errors. */
export function parseInput(v: {
  title?: unknown;
  url?: unknown;
  tags?: unknown;
}): { ok: true; value: BookmarkInput } | { ok: false; issues: Record<string, string> } {
  const issues: Record<string, string> = {};
  const title = String(v.title ?? "").trim();
  const url = String(v.url ?? "").trim();
  if (!title) issues.title = "Title is required";
  else if (title.length > 200) issues.title = "Title is too long";
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") issues.url = "Use an http(s) URL";
  } catch {
    issues.url = "Enter a valid URL";
  }
  if (Object.keys(issues).length) return { ok: false, issues };
  return { ok: true, value: { title, url, tags: normalizeTags(Array.isArray(v.tags) ? (v.tags as string[]).map(String) : String(v.tags ?? "")) } };
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export function listBookmarks(db: DatabaseSync, o: ListOptions = {}): Page {
  const limit = Math.min(Math.max(o.limit ?? 20, 1), 100);
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (o.q?.trim()) {
    where.push("(title LIKE ? ESCAPE '\\' OR url LIKE ? ESCAPE '\\')");
    const like = `%${escapeLike(o.q.trim())}%`;
    args.push(like, like);
  }
  if (o.tag) {
    where.push("tags LIKE ? ESCAPE '\\'");
    args.push(`%,${escapeLike(o.tag)},%`);
  }
  if (o.before) {
    where.push("id < ?");
    args.push(o.before);
  }
  const sql = `SELECT id, title, url, tags, created_at FROM bookmarks ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`;
  const rows = db.prepare(sql).all(...args, limit + 1) as Row[];
  const items = rows.slice(0, limit).map(toBookmark);
  return { items, next: rows.length > limit ? items[items.length - 1]!.id : null };
}

export function getBookmark(db: DatabaseSync, id: number): Bookmark | null {
  const r = db.prepare("SELECT id, title, url, tags, created_at FROM bookmarks WHERE id = ?").get(id) as Row | undefined;
  return r ? toBookmark(r) : null;
}

export function createBookmark(db: DatabaseSync, input: BookmarkInput, now = Date.now()): number {
  const r = db.prepare("INSERT INTO bookmarks (title, url, tags, created_at) VALUES (?, ?, ?, ?)").run(input.title, input.url, packTags(input.tags), now);
  return Number(r.lastInsertRowid);
}

export function updateBookmark(db: DatabaseSync, id: number, input: BookmarkInput): boolean {
  return Number(db.prepare("UPDATE bookmarks SET title = ?, url = ?, tags = ? WHERE id = ?").run(input.title, input.url, packTags(input.tags), id).changes) > 0;
}

export function deleteBookmark(db: DatabaseSync, id: number): boolean {
  return Number(db.prepare("DELETE FROM bookmarks WHERE id = ?").run(id).changes) > 0;
}

export function allTags(db: DatabaseSync): string[] {
  const set = new Set<string>();
  for (const r of db.prepare("SELECT DISTINCT tags FROM bookmarks WHERE tags <> ''").all() as { tags: string }[]) for (const t of splitTags(r.tags)) set.add(t);
  return [...set].sort();
}

export function countBookmarks(db: DatabaseSync): number {
  return Number((db.prepare("SELECT COUNT(*) AS n FROM bookmarks").get() as { n: number }).n);
}

export function exportBookmarks(db: DatabaseSync): BookmarkInput[] {
  return (db.prepare("SELECT title, url, tags FROM bookmarks ORDER BY id").all() as Row[]).map((r) => ({
    title: r.title,
    url: r.url,
    tags: splitTags(r.tags),
  }));
}

/** All-or-nothing import; returns the number of rows added, or the first invalid index. */
export function importBookmarks(db: DatabaseSync, items: unknown): { added: number } | { error: string } {
  if (!Array.isArray(items)) return { error: "Expected a JSON array" };
  if (items.length > 5000) return { error: "At most 5000 bookmarks per import" };
  const parsed: BookmarkInput[] = [];
  for (const [i, item] of items.entries()) {
    const r = parseInput((item ?? {}) as Record<string, unknown>);
    if (!r.ok) return { error: `Item ${i}: ${Object.values(r.issues).join(", ")}` };
    parsed.push(r.value);
  }
  db.exec("BEGIN");
  try {
    for (const p of parsed) createBookmark(db, p);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { added: parsed.length };
}

/** Deterministic seed: the same `count` rows every time (no clock, no randomness). */
export function seedBookmarks(db: DatabaseSync, count = 500): number {
  const topics = ["rust", "web", "database", "design", "css", "node", "testing", "perf"];
  db.exec("BEGIN");
  for (let i = 1; i <= count; i++) {
    const a = topics[i % topics.length]!;
    const b = topics[(i * 3) % topics.length]!;
    createBookmark(
      db,
      { title: `Reading list item ${i}: ${a} and ${b}`, url: `https://example.com/${a}/${i}`, tags: [...new Set([a, b])] },
      1_700_000_000_000 + i * 60_000,
    );
  }
  db.exec("COMMIT");
  return count;
}

let shared: DatabaseSync | undefined;
/** Process-wide connection (`DATABASE_PATH`, default `data/bookmarks.db`); seeds an empty database once. */
export function getDb(): DatabaseSync {
  if (!shared) {
    shared = openDb(process.env.DATABASE_PATH || "data/bookmarks.db");
    if (countBookmarks(shared) === 0) seedBookmarks(shared);
  }
  return shared;
}
