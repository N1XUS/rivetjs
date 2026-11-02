# examples/sqlite-local

- DB access only in `src/server/db.server.ts` (`node:sqlite` `DatabaseSync`); never import it from a component. `getDb()` = process singleton (`DATABASE_PATH`, default `data/bookmarks.db`), seeds 500 rows when empty. Tests use `openDb(":memory:", migrationsDir)`.
- Tags stored as `,a,b,` text; filter = `LIKE '%,tag,%'` with LIKE wildcards escaped.
- Pagination: keyset on `id DESC` (`before` cursor, page size 20, `next` = last id or null).
- Actions redirect 303 to `/` keeping `q` / `tag` (the forms carry them as hidden fields: they post to `?/<action>`); validation error = `?error=<code>` (`ERRORS` table in `index.server.ts`; unknown codes show nothing, so a crafted link cannot inject alert text; no `fail()` state: JS-off friendly, input is not echoed). `/api/import`: no auth (single-user local app), body capped by the router `maxBody` (1 MiB). `seedBookmarks` rolls back on failure.
- Not done vs plan T5: Drizzle (not installed; plain SQL), `@rivetjs/forms`, Chromium e2e (HTTP-level JS-off tests instead).
- `tests/app.test.ts` builds into `dist/` and binds port 4470.
