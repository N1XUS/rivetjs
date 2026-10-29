# sqlite-local

Bookmarks app on a local SQLite file through Node's built-in `node:sqlite` (no native addon). Rivet server app: pages render per request; every action is a plain `<form method="post">` answered with a 303 redirect, so it works with JavaScript off.

## Run

```sh
cp .env.example .env     # DATABASE_PATH=data/bookmarks.db
npx vite build && npx vite build --ssr
node serve.ts            # http://127.0.0.1:3000 (first start migrates + seeds 500 rows)
```

Dev: `npx vite`. Reset: delete `data/`.

## What it shows

- `src/server/db.server.ts`: connection (WAL, foreign keys, busy timeout), SQL migrations from `migrations/` (applied once, tracked in `_migrations`), queries, deterministic seed.
- `src/routes/index.server.ts`: `load` with `depends("bookmarks")`, search `?q=`, tag `?tag=`, keyset cursor `?before=<id>`, `actions` create / update / remove.
- `src/routes/api/export.json.ts` (GET) and `api/import.ts` (POST a JSON array, all or nothing).
- `/healthz` is built into the node adapter.

## Test

`npx vitest run --project examples --maxWorkers=1` from the repo root: queries on `:memory:`, then build + boot + JS-off form posts, import / export, CSRF origin check, client JS budget (40 KB).

Versions verified 2026-10-29: Node 26.5 (`node:sqlite`; Node >= 24 required), Vite 8.
