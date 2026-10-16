# Backend-heavy examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ten runnable backend reference apps under `examples/` (sqlite, Postgres + Drizzle, Redis, background jobs, Kafka, gRPC / Connect, Docker full stack, auth sessions, WebSockets, S3 uploads), each with compose services, migrations, seed, `.env.example`, README and tests that run without Docker; shared run / check / smoke tooling; the router helpers they surface (server entries, lifecycle hooks, SSE, env); a "Backend recipes" docs section.

**Architecture:** top-level `examples/<name>` workspaces (own drivers, never built by the docs); `examples/_shared` copied (drift-checked) fragments; `scripts/examples/{run,check,smoke,list,sync-shared}.ts`; nx inferred projects `example-<name>`; CI runs `check` + `test` on in-process fakes only (PGlite, `node:sqlite`, Connect in-memory transport, `ws`, memory ports for Redis / Kafka / S3); full stacks only via `npm run example:<name>`.

**Tech Stack:** TypeScript (Node 26), `@rivetjs/router` node adapter, `@rivetjs/forms`, Drizzle ORM (node-sqlite / node-postgres / pglite drivers), `pg`, `@electric-sql/pglite`, `pg-boss`, `ioredis`, `kafkajs`, `@connectrpc/connect{,-node,-web}` + `@bufbuild/protobuf`, `ws`, `aws4fetch`, Docker Compose v2 (local only), vitest + Playwright Chromium, docs-kit.

**Spec:** [`docs/design/specs/2026-10-12-backend-examples-design.md`](../specs/2026-10-12-backend-examples-design.md).

## Global Constraints

- `S=/private/tmp/claude-501/-Users-denisseverin-Projects-claude-test-rivet/d5c17ad1-df18-48dc-b37c-7b09decaac8e/scratchpad`; read `$S/perf/IMPL-COMMON.md` when present (binding).
- Env: `export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH NX_DAEMON=false NX_ISOLATE_PLUGINS=false`; zsh; repo root, absolute paths.
- **No Docker in CI, ever**: `check` / `test` targets must pass with Docker absent (`PATH` without `docker`; T1 adds a test that asserts this). Compose stacks only through `npm run example:<name>` / `smoke.ts` on a developer machine or the manual `examples-stack.yml` workflow.
- **RAM ≤ 3 GB** peak tree RSS for any command (vitest `--maxWorkers=1`, one Playwright browser, examples checked sequentially); every `compose.yaml` total `mem_limit` ≤ 3 GB (checked by `check.ts`); **one stack at a time** (`run.ts` lock on `rivet-ex-*` projects); heavy commands through `bash $S/heavy.sh …` (shared CPU gate) when present.
- No host toolchains (brew, rustup, pip globals, global npm installs); no native npm addons in default paths (`node:sqlite`, `node:crypto` scrypt, KafkaJS, `aws4fetch`); Buf output (`gen/`) checked in, generation only via `npx buf` devDependency on demand.
- Secrets: commit `.env.example` only; dev credentials obviously fake (`rivet-dev`); `check.ts` secret grep must stay green.
- Versions: exact pins in each example `package.json`; compose images tag + digest comment; README "Versions verified <date>" line.
- Rivet rules: resumable handlers (inline arrows / local consts), `*.server.ts` for server code, lucide icons via `@rivetjs/kit/icon` (never invented SVG / UTF glyphs), zero-cost for every new router subpath (`sh scripts/zero-cost/check.sh`; intended `--update` named in the commit), size-report `--check` when router bytes change.
- Docs follow code: nearest `CLAUDE.md` (new `examples/CLAUDE.md`, `libs/router/**/CLAUDE.md`, `scripts/CLAUDE.md`, root repo map) + every page describing a changed API updated in the same commit; llms / MCP data / AI files regenerated, never hand-edited.
- Never touch user WIP: `apps/playground/src/routes/_layout.tsx`, `apps/playground/tsconfig.json`, `apps/docs/examples/todo-list/src/routes/index.tsx`, `*-tmp.ts`.
- Git (shared tree): temp index per commit — `export GIT_INDEX_FILE=$S/idx-BACKEND-$$; git read-tree HEAD; git add -- <own files>` (file with foreign uncommitted hunks: blob = HEAD + own hunks via `git hash-object -w` + `git update-index --cacheinfo`), `git commit`, `unset GIT_INDEX_FILE`; verify `git diff --stat HEAD~1 HEAD` lists only own files. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Shared files (root `package.json` workspaces / scripts, `package-lock.json`, `.github/workflows/ci.yml`, `apps/docs/content/_nav.ts`, `docs/CLAUDE.md`, root `CLAUDE.md`, `ROADMAP.md`): own hunks only.

### Gate commands (each task lists which it runs)

```bash
H="bash $S/heavy.sh"
# G-EX     node scripts/examples/check.ts <name>            (no Docker: build + boot on fakes + budgets + lint)
# G-EXT    npx vitest run --project examples --maxWorkers=1 examples/<name>/tests
# G-STACK  npm run example:<name> -- --detach && node scripts/examples/smoke.ts <name> && npm run example:<name> -- --down   (local only, never CI)
# G-ROUTER npx vitest run --project router --maxWorkers=1 && npx vitest run --project forms --maxWorkers=1
# G-TYPE   npm run typecheck (or scoped: npx nx run <project>:typecheck --output-style=static --skip-nx-cache)
# G-ZERO   $H sh scripts/zero-cost/check.sh
# G-SIZE   $H npm run size-report -- --check
# G-DOCS   $H npx nx run docs:build ; node libs/docs-kit/cli.ts check-content apps/docs --strict ; check-snippets apps/docs ; llms apps/docs --check
# G-AI     node libs/mcp/build-data.ts --check && node libs/mcp/ai/sync.ts --check
# G-FMT    npm run format:check
```

## File Structure

- `examples/CLAUDE.md`, `examples/README.md`, `examples/_shared/{compose/*.yaml, wait-for.ts, env.ts, pglite.ts, Icon.tsx, contract.ts}`.
- `examples/<name>/{README.md, package.json (rivetExample metadata), vite.config.ts, tsconfig.json, serve.ts, .env.example, .gitignore, shared.json, compose.yaml?, Dockerfile?, worker.ts?, migrations/, scripts/{migrate,seed}.ts, src/routes/**, src/server/*.server.ts, src/env.server.ts, tests/*.test.ts, tests/e2e.test.ts}` for `sqlite-local`, `postgres-drizzle`, `redis-cache-sessions`, `bg-jobs-queue`, `kafka-events`, `grpc-connect` (+ `proto/`, `gen/`, `inventory/`), `docker-fullstack`, `auth-sessions`, `websockets-realtime`, `file-uploads-s3`.
- `scripts/examples/{run,check,smoke,list,sync-shared}.ts`, `scripts/tests/examples-*.test.ts`; vitest project `examples` in root `vitest.config.ts`.
- Router: `libs/router/build/{vite,codegen}.ts` (server entries), `libs/router/cli/rivet.ts` (`rivet run`), `libs/router/adapters/node.ts` (+ `uws.ts`) lifecycle, `libs/router/sse.ts` + `client/live-source.ts`, `libs/router/env.ts`; tests in `libs/router/tests/`.
- Docs: `apps/docs/content/backend/{overview,<name>}.md`, `_nav.ts` section, docs-kit `::source` / `::readme` directives (`libs/docs-kit/tools/content/*`), updates to `guides/deploy/docker.md`, `recipes/live-updates.md`, `guides/routing/{endpoints,loading-data}.md`, `guides/performance/streaming.md`; `templates/starter-server/README.md`; `libs/mcp/ai` backend reference.
- CI: `.github/workflows/ci.yml` (examples check + test job), `.github/workflows/examples-stack.yml` (manual + weekly, non-blocking).

## Task overview

| # | Task | Depends |
| --- | --- | --- |
| T1 | Shared infra: `examples/` workspace, `_shared`, `scripts/examples/*`, vitest project, nx inference, CI job | — |
| T2 | Router G4: `@rivetjs/router/env` (`defineEnv`) | — |
| T3 | Router G2: extra server entries + `rivet run <entry>` | — |
| T4 | Router G3: node adapter `ready` / `onClose` lifecycle hooks (+ uWS) | — |
| T5 | E1 `sqlite-local` | T1 (T2 optional) |
| T6 | E2 `postgres-drizzle` (+ PGlite harness in `_shared`) | T1, T5 |
| T7 | E6 `redis-cache-sessions` | T1 |
| T8 | Router G6: `@rivetjs/router/sse` `eventStream` + client `liveSource` | — |
| T9 | Spike: pg-boss over PGlite (`pglite-socket`) — go / fallback | T6 |
| T10 | E5 `bg-jobs-queue` | T3, T4, T8, T9 |
| T11 | E9 `kafka-events` (Redpanda, outbox, memory bus) | T3, T8, T6 |
| T12 | E10 `grpc-connect` (Connect service, BFF loaders, endpoint mount, streaming) | T1, T8 |
| T13 | E4 `docker-fullstack` (production composition, drain test) | T3, T4, T10 |
| T14 | E3 `auth-sessions` | T6 |
| T15 | E8 `websockets-realtime` (+ G5 measurement note) | T1, T14 |
| T16 | E7 `file-uploads-s3` (+ G8 per-route body limit if needed) | T1 |
| T17 | docs-kit `::source` / `::readme` directives | — |
| T18 | Docs section "Backend recipes" + page updates + starter README + llms / MCP / AI | T5–T17 |
| T19 | Final gates + optional `examples-stack.yml` run + report | all |

## Tasks

### T1 — Shared infra

**Files:** root `package.json` (workspaces `examples/*` excluding `_shared`, scripts), `vitest.config.ts` (project `examples`), `examples/{CLAUDE.md,README.md}`, `examples/_shared/**`, `scripts/examples/{run,check,smoke,list,sync-shared}.ts`, `scripts/tests/examples-scripts.test.ts`, `.github/workflows/ci.yml`, `scripts/CLAUDE.md`, root `CLAUDE.md` (repo map row).

- [ ] Workspace glob + decide script form (`example:<name>` generated vs `npm run example -- <name>`); record in `examples/CLAUDE.md`.
- [ ] `_shared`: compose fragments (postgres 17-alpine 256M, redis 8-alpine 64M, minio 256M, redpanda 768M; healthchecks, named volumes), `wait-for.ts`, `env.ts`, `Icon.tsx` (lucide), `contract.ts` (helper to run one behaviour suite against fake + real).
- [ ] `run.ts`: Docker presence check, lock (one `rivet-ex-*` project), `compose up -d --wait`, migrate, seed, build, `serve.ts`, Ctrl+C → drain + `compose stop`; `--reset`, `--detach`, `--down`.
- [ ] `check.ts`: sync, rivet-check, tsc, build, boot on `BACKEND=memory`, `/healthz` + `/` + one action, JS budget from manifest, env coverage, compose lint (pinned tags, healthchecks, `mem_limit`, sum ≤ 3 GB), secret grep. Runs with `docker` absent.
- [ ] `sync-shared.ts --check` (drift), `list.ts` (metadata JSON for docs + MCP).
- [ ] nx: confirm `@rivetjs/nx/plugin` infers `example-<name>` (or add `project.json` with `check` / `test` / `serve`; `serve` never cached, excluded from CI).
- [ ] CI job `examples`: `node scripts/examples/sync-shared.ts --check && node scripts/examples/check.ts && npx vitest run --project examples`.
- [ ] Measure added install size (≤ 60 MB budget) — record in `examples/CLAUDE.md`.
- Gates: unit tests for script helpers (lint rules, lock, env coverage), G-TYPE (scripts), G-FMT.

### T2 — `@rivetjs/router/env`

**Files:** `libs/router/env.ts`, `libs/router/package.json` exports, `build/vite.ts` (browser import guard like `server-only`), `tests/env.test.ts`, `libs/router/CLAUDE.md`, `docs/guides/server-code.md`, `apps/docs/content/guides/security/server-only-code.md` (+ new section "Environment variables").

- [ ] `defineEnv(schema, source = process.env)` → frozen typed object; Standard Schema v1 (vendored types, as forms); aggregate error listing every bad key; `import.meta.env`-free.
- [ ] Browser graph import = build error; zero-cost entry in `scripts/zero-cost`.
- Gates: G-ROUTER, G-ZERO, G-SIZE, G-DOCS (content), G-AI.

### T3 — Extra server entries + `rivet run`

**Files:** `libs/router/build/{vite,codegen}.ts`, `adapters/build.ts`, `cli/rivet.ts`, `tests/server-entries.test.ts` (+ fixture), router CLAUDE.md files, `docs/guides/routing.md`, `apps/docs/content/guides/routing/server-code-in-routes.md` (or new `guides/routing/server-entries.md`).

- [ ] `rivetRouter({ serverEntries: { name: path } })` → extra SSR inputs → `dist/server/<name>.js` sharing chunks with `entry.server.js`; unset = byte-identical output (zero-cost).
- [ ] `rivet run <name> [--watch]`: dev via Vite module runner (restart on change), prod hint → `node dist/server/<name>.js`.
- [ ] Test: entry imports a `*.server.ts` module + alias; one module instance per process; dev restart.
- Gates: G-ROUTER, G-ZERO, G-SIZE, G-DOCS, G-AI.

### T4 — Lifecycle hooks

**Files:** `libs/router/adapters/{node,uws}.ts`, `tests/node-lifecycle.test.ts`, `adapters/CLAUDE.md`, `apps/docs/content/guides/deploy/{node,docker}.md`, `templates/starter-server/serve.js` + README (if adopted there), size baseline.

- [ ] `start` / `serve` options `ready?: () => boolean | Promise<boolean>` (`/readyz` 503 `starting` until true, cached ≤ 1 s) and `onClose?: () => Promise<void>` (after drain, inside `grace`); `closeOnSignals` awaits it, exit code 0 / 1 on hook error.
- [ ] Tests: readiness flip, hook order (stop accept → drain → onClose → exit), grace timeout.
- Gates: G-ROUTER, G-ZERO, G-SIZE, G-DOCS, templates test (`npx nx run docs:test` scope `templates.test.ts`) if the template changes.

### T5 — E1 `sqlite-local`

**Files:** `examples/sqlite-local/**`.

- [ ] Bookmarks: list (search + tag filter from URL, keyset pagination), create / edit / delete via `@rivetjs/forms` (JS-off works), import endpoint `api/import.ts` (JSON), export `api/export.json.ts`; `invalidate("bookmarks")`.
- [ ] Drizzle `node-sqlite` driver, WAL, `migrations/` from drizzle-kit, deterministic seed (500 rows).
- [ ] Tests: queries on `:memory:`, actions through `createHandler`, e2e (Chromium) JS on + JS off.
- [ ] README per spec §1.2; `.env.example` (`DATABASE_PATH`).
- Gates: G-EX, G-EXT, G-FMT.

### T6 — E2 `postgres-drizzle`

**Files:** `examples/postgres-drizzle/**`, `examples/_shared/pglite.ts`.

- [ ] Issue tracker schema (projects / issues / labels / comments), migrations, seed 10k issues.
- [ ] Pages: list (URL filters, keyset pagination, live page), issue detail (comments form, field errors from unique violations), stats panel streamed (`Async` + fallback; `?slow=1` adds `pg_sleep(1)`), optimistic status toggle with rollback on `fail()`.
- [ ] `db.server.ts`: pool singleton (dev HMR-safe, documents G7), `onClose` → `pool.end()` (T4 when landed).
- [ ] Tests on PGlite (same migrations); e2e on PGlite behind node adapter: TTFB unaffected by `?slow=1` (head + list bytes before stats), JS-off edit.
- [ ] README "Using Prisma instead" + "MySQL" notes; record measured TTFB vs complete in README.
- Gates: G-EX, G-EXT, G-STACK (local), G-FMT.

### T7 — E6 `redis-cache-sessions`

**Files:** `examples/redis-cache-sessions/**`.

- [ ] Store port (memory + ioredis adapters); `cached(key, ttl, fn, { tags, swr })` with single-flight lock; tag invalidation from actions; Redis session store; sliding-window rate limit in root `onRequest` (429 + `Retry-After`); `x-cache` header.
- [ ] Simulated slow upstream (300 ms); README table p50 cold vs warm (measured on stack).
- [ ] Tests: cache semantics on memory store via `contract.ts` (same suite runs on Redis in smoke).
- Gates: G-EX, G-EXT, G-STACK, G-FMT.

### T8 — `@rivetjs/router/sse` + `liveSource`

**Files:** `libs/router/sse.ts`, `libs/router/client/live-source.ts`, exports, tests, CLAUDE.md, `apps/docs/content/recipes/live-updates.md` + `apps/docs/examples/live-updates/src/routes/events.ts` (migrate to the helper), `guides/routing/endpoints.md`.

- [ ] `eventStream(event, (send, close) => cleanup, { heartbeat, retry })`: abort-safe, backpressure-aware (`desiredSize`), `id` / `event` fields, cleanup exactly once.
- [ ] `liveSource(url, { parse })` → signal; opens in `clientEffect`, closes on route leave; resumable usage documented.
- Gates: G-ROUTER, G-ZERO, G-SIZE, G-DOCS (docs example build), G-AI.

### T9 — Spike: pg-boss over PGlite

- [ ] `@electric-sql/pglite-socket` + `pg-boss` start / send / work / retry / schedule against PGlite in-process; note gaps (LISTEN/NOTIFY, advisory locks).
- [ ] Ruling recorded in `examples/CLAUDE.md`: GO = E5 tests use it; FALLBACK = memory queue port in tests + pg-boss behaviour only in G-STACK smoke.

### T10 — E5 `bg-jobs-queue`

**Files:** `examples/bg-jobs-queue/**` (`worker.ts` via `serverEntries`).

- [ ] Export action: insert `exports` row + `boss.send` in one transaction (Drizzle adapter); worker writes CSV to `data/exports/`, reports progress to `export_progress`; SSE endpoint (`eventStream`) → live progress bar; retries with backoff, DLQ page + "retry" action, cancel action, cron cleanup, idempotency key.
- [ ] Worker graceful stop (`boss.stop({ graceful })` in `onShutdown`), restart mid-job resumes.
- [ ] Tests per T9 ruling; e2e: enqueue → progress → download (fakes); README BullMQ swap diff + Temporal / Inngest / Trigger.dev paragraph.
- Gates: G-EX, G-EXT, G-STACK, G-FMT.

### T11 — E9 `kafka-events`

**Files:** `examples/kafka-events/**` (`relay.ts`, `consumer.ts` server entries), `_shared/compose/redpanda.yaml`.

- [ ] Orders action: order + outbox row in one tx; relay (poll + `FOR UPDATE SKIP LOCKED`) publishes keyed messages (KafkaJS); consumer projects inventory read model idempotently (`processed_messages` table); SSE live feed; ops page with consumer lag.
- [ ] Bus port: memory broker (partitions, keys, offsets, redelivery, duplicate injection); `contract.ts` suite runs against memory and Redpanda.
- [ ] README Confluent client swap; Redpanda ≤ 768 MB.
- Gates: G-EX, G-EXT, G-STACK, G-FMT.

### T12 — E10 `grpc-connect`

**Files:** `examples/grpc-connect/**` (`proto/`, `buf.gen.yaml`, `gen/`, `inventory/` service process).

- [ ] Inventory service (`connectNodeAdapter`, HTTP/2 h2c): unary `GetStock`, `ListProducts`, server-streaming `WatchStock`; Protovalidate interceptor.
- [ ] Storefront loaders: `createGrpcTransport` (HTTP/2) with deadline + request `AbortSignal`; error mapping `ConnectError` → `HttpError` / `fail()`; streaming RPC → `eventStream` → live badge.
- [ ] Endpoint mounting the Connect router for browser calls (Connect protocol, same origin, cookies + CSRF semantics documented); client chunk only on the page that uses it (size check).
- [ ] Tests: `createRouterTransport` loader tests; HTTP/2 against service on port 0; cancellation propagates.
- Gates: G-EX, G-EXT, G-STACK, G-FMT.

### T13 — E4 `docker-fullstack`

**Files:** `examples/docker-fullstack/**` (`Dockerfile`, `compose.yaml` with `app`, `worker`, `migrate`, `postgres`, `redis`, profiles `proxy` (Caddy) + `scale`).

- [ ] Multi-stage Dockerfile (deps / build / runtime, `node:26-slim` digest, `USER node`, `read_only` + tmpfs, `npm ci --omit=dev`); `HEALTHCHECK` → `/readyz`; `ready` hook checks pg + redis; `onClose` closes pools; `trustProxy: 1` under proxy profile; `stream: { deadline }`.
- [ ] Tests (no Docker): boot `dist` on memory backends in a child process, SIGTERM mid-request → completes, exit 0; compose YAML lint; README image size + idle RSS measured on the stack (≤ 180 MB, ≤ 80 MB).
- [ ] Update `apps/docs/content/guides/deploy/docker.md` link + `templates/starter-server` Dockerfile only if a hardening applies to both (separate commit, size baseline).
- Gates: G-EX, G-EXT, G-STACK, G-FMT.

### T14 — E3 `auth-sessions`

**Files:** `examples/auth-sessions/**`.

- [ ] Sessions table (hashed token, sliding expiry, rotation on privilege change), `__Host-session` cookie, root `serverGuard` → `locals.user`, sign up / in / out, sessions list + "sign out others", password reset token (console transport), scrypt hashing, login rate limit (per IP + per account), `safeRedirect`.
- [ ] Optional GitHub OAuth (`arctic`, PKCE + state cookie) behind env flag; fake provider in tests.
- [ ] Tests on PGlite; e2e JS on / off; security checklist in README (OWASP session items).
- Gates: G-EX, G-EXT, G-STACK, G-FMT.

### T15 — E8 `websockets-realtime`

**Files:** `examples/websockets-realtime/**`.

- [ ] Board: loader SSR state + version; `ws` on `serving.server` `upgrade` with session-cookie auth + Host check reuse; `clientEffect` connects on visibility / first interaction; reconnect + resync by version; presence; actions JS-off; optional Redis pub/sub profile for 2 replicas.
- [ ] `onClose` closes sockets with 1001; tests with two in-process clients.
- [ ] Note for G5 (upgrade route) with measured bytes / code duplication → spec input in `examples/CLAUDE.md`.
- Gates: G-EX, G-EXT, G-STACK (redis profile), G-FMT.

### T16 — E7 `file-uploads-s3`

**Files:** `examples/file-uploads-s3/**` (+ router `maxBody` per route if G8 needed: own sub-commit with router tests + docs).

- [ ] MinIO + `mc` init; presigned POST policy action (size / type / prefix); confirm action stores metadata; signed GET in loaders; JS-off multipart fallback streamed to S3; progress via `XMLHttpRequest.upload` in a `clientEffect`.
- [ ] Tests: SigV4 test vectors, fs-backed fake S3 endpoint for e2e.
- Gates: G-EX, G-EXT, G-STACK, G-FMT (+ G-ROUTER / G-ZERO / G-SIZE if router changes).

### T17 — docs-kit `::source` / `::readme`

**Files:** `libs/docs-kit/tools/content/*`, docs-kit tests, `libs/docs-kit/CLAUDE.md`.

- [ ] `::source{path region lang title}` reads repo files (inside repo root only), `#region` aware, build error on missing file / region; `::readme{example section}` embeds a README section; both included in `check-snippets` and llms outputs.
- [ ] Docs build RSS / time measured before / after (no regression > 5 %).
- Gates: docs-kit tests, G-DOCS.

### T18 — Docs section + cross-links

**Files:** `apps/docs/content/backend/{overview,sqlite-local,postgres-drizzle,auth-sessions,docker-fullstack,bg-jobs-queue,redis-cache-sessions,file-uploads-s3,websockets-realtime,kafka-events,grpc-connect}.md`, `_nav.ts`, updated guides (spec §7), `templates/starter-server/README.md`, `libs/mcp/ai/**` backend reference, MCP data (examples list from `list.ts`), `apps/docs/CLAUDE.md`.

- [ ] Pages per spec §7 (plain language, verified claims, numbers from READMEs' measured lines); overview matrix.
- [ ] Regenerate llms, MCP data, AI files; check-content strict, check-snippets.
- Gates: G-DOCS, G-AI, templates test, G-FMT.

### T19 — Final gates + report

- [ ] Full gate set (G-TYPE, G-ROUTER, G-ZERO, G-SIZE, G-DOCS, G-AI, G-FMT, examples CI job) green; `examples-stack.yml` dispatched once (non-blocking) and results noted.
- [ ] `ROADMAP.md` row updated; spec "Status" line → implemented items; follow-up specs opened for G1 (streamed loader data) and G5 (upgrade route).
