// The one database connection (node:sqlite, no native addon). Server-only: never import it from a component.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

/** Opens (creating directories) a database with WAL, foreign keys and the pending migrations applied. */
export function openDb(path: string, migrations = join(process.cwd(), "migrations")): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db, migrations);
  return db;
}

/** Applies `migrations/*.sql` in name order, each once (tracked in `_migrations`), each in a transaction. */
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

let shared: DatabaseSync | undefined;
/** Process-wide connection (`DATABASE_PATH`, default `data/auth.db`). */
export function getDb(): DatabaseSync {
  return (shared ??= openDb(process.env.DATABASE_PATH || "data/auth.db"));
}
