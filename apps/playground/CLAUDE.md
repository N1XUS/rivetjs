# @rivetjs/playground

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Example file-routed app on `@rivetjs/router`: compiled JSX, Tailwind 4, signals, two-way models, keyed lists, server loaders, lazy route chunks, client-only module, page-view effect, images, slots, scoped styles, nested layouts. Server-rendered + resumed; client navigation fetches route data from the server. Also the target of the Lighthouse audit, latency budget and size report.

## Entry points

- `build.ts` — `buildPlayground()`: Vite app builder (server first, then client, so server-only image variants land in `dist/client/assets`), then esbuild `server.ts` → `dist/serve.mjs`; writes `dist/artifact-sizes.json`.
- `server.ts` — `createPlaygroundServer({ port = 4173, host = "127.0.0.1", dev })`; prod serves `dist/` via `@rivetjs/router/node`, `--dev` runs Vite + router dev middleware (HMR, no resume state).
- `vite.config.ts` — `rivetRouter({ styles, resume.modules: [resume-demo, page-views], images.presets.hero, transitions })` + Tailwind.
- `latency.ts` — warm p50/p90/p99 per route (`/`, `/resume`, `/items/1`) on `LATENCY_PORT` (4198); fails if warm p50 > `LATENCY_BUDGET_MS` (1 ms).
- `lighthouse.ts` — `auditPlayground()`: Lighthouse mobile ×3 on `/`, `/items/1`.
- `scripts/hero.ts` — regenerates `src/assets/hero.jpg`.
- `Dockerfile` — prod image (dist only, user `node`, port 8080, `/healthz`, `/readyz`).

## Layout

- `src/routes/` — `_layout.tsx` (header/counter/footer, hero), `index.tsx`, `items/[id].tsx`, `resume.tsx`, `slots.tsx` (slots + in-file `load(…)`/`onGet(…)`), `styles.tsx` + `styles.module.css`, `nested/{_layout,one,two}.tsx`, `_404.tsx`; endpoints `api/items.ts`, `api/items/[id].ts`, `api/time.ts`, `csr/…` (308 → resumed pages).
- `src/document.ts` — document shell (title/description defaults, icon, stylesheets via `headTags(undefined, { styles, inlineStyles, nonce })`: every page's sheets (Tailwind ~3.5 KB br + the `/styles` route sheet) total ≤ 6 KB br, so all are inline and no page requests a stylesheet: `rivetRouter({ inlineStylesheets })` default; `tests/server.test.ts`).
- `src/services/server.ts` — seeded server services; `src/context.ts` — `Item` type.
- `src/resume-demo.tsx`, `src/page-views.tsx` (+ `src/analytics.ts` idle chunk), `src/browser-widget.tsx` (client-only), `src/styles.css`, `src/assets/`.
- `tests/` — vitest `playground` project: `build` (strict JSX TS check + build output), `server`, `resume` (Playwright), `slots` (Playwright).
  - `resume.test` loader budget mirrors `libs/runtime/tests/resume-loader.test.ts` (1,912 B br; the `$rx` add-ons (expand, repeat) are the only other inline scripts allowed). Lazy router (Z1): pages carry only fetch-only hints for runtime + router chunks (state `data-fo`, added as low-priority modulepreload links by the loader module after `load` + web fonts; no eager preloads); `/` has no `data-preload` (read the runtime from state `rt`).

## Rules / invariants

- **Never touch `src/routes/_layout.tsx` or `tsconfig.json`** — user's uncommitted WIP.
- Icons: use an icon library (lucide); never hand-written SVG paths or UTF symbols (✓ × ▾ → ★) as icons.
- Prod pages: complete server HTML + resume state + one inline loader, no module script before interaction; links work without JS.
- Loaders/guards always run on the server; browser build carries no route server code (`slots.test.ts` asserts it).
- Resumability needs a production build; `dev` client-renders.

## Commands

- Build + test: `node apps/playground/build.ts && npx vitest run --project playground` (or `NX_DAEMON=false npx nx run playground:test`, builds first).
- Typecheck: `node scripts/tsc.ts -p apps/playground` (tsgo); Rivet checker: `npx nx run playground:rivet-check`.
- Run: `npm run start:playground` (http://127.0.0.1:4173, `PORT`/`HOST`), `npm run dev`.
- `npx nx run playground:latency`, `npm run audit:playground` (→ `.artifacts/playground/lighthouse`) — with builds/benchmarks stopped.
- Docker: `docker build -f apps/playground/Dockerfile -t rivet-playground . && docker run --rm -p 8080:8080 rivet-playground`.

## Gotchas

- Tests import `dist/` output — rebuild after router/compiler/runtime changes.
- `scripts/size-report.mjs` builds this app (`--apps=playground`); keep `build.ts` / `vite.config.ts` paths.

## See also

- [README.md](README.md), [../../docs/guides/resumability.md](../../docs/guides/resumability.md), [../../docs/guides/routing.md](../../docs/guides/routing.md), [../../docs/guides/slots.md](../../docs/guides/slots.md), [../../docs/guides/styles.md](../../docs/guides/styles.md)
