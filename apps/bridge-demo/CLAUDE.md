# apps/bridge-demo

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Bridges demo (lane BRIDGES, spec `docs/design/specs/2026-10-12-bridges-demo.md`): one realistic React 19 dashboard ("Ops dashboard": overview with KPI cards + recharts revenue chart, orders table with TanStack Table + Radix Dialog, order form with react-hook-form + zod) as a Next 16 App Router app and as Rivet file routes with the same components as React islands (`@rivetjs/bridge-react`). Measured per route by `run.ts` → `report.ts` → `docs/benchmarks/2026-10-12-bridges-demo.{md,json}` (+ hand-written `.notes.md`). Human intro: [README.md](README.md).

## Layout

- `components/*.react.tsx` — the shared React components (`OrdersTable` + `OrderModal`, `RevenueChart`, `OrderForm` + `schema.ts`, `UserMenu`), imported unchanged by both lanes (relative paths, `/** @jsxImportSource react */`). `components/tsconfig.json` = React JSX project for editors.
- `data.ts` — seeded data (500 orders, 12-month revenue, KPIs, recent 10, `NAV`); `site.css` — the shared plain CSS (Next imports it in `layout.jsx`; Rivet inlines it via `rivetRouter({ styles })`).
- `package.json` — workspace member `@rivetjs/bridge-demo`: the five libraries pinned (`@tanstack/react-table` 9.3.1, `react-hook-form` 7.90.0, `@hookform/resolvers` 5.9.1, `recharts` 3.10.1, `@radix-ui/react-dialog` 1.3.0) + react / react-dom 19.3.0, zod 3.25.76; root lockfile.
- `next/` — own install (`build.log` gitignored) (`package.json` pins next 16.4.0 + the same libraries, own `package-lock.json`, `node_modules` gitignored). `app/layout.jsx` (server layout, `force-dynamic`, `Nav` client component with `usePathname` + `<Link>`; `BD_PREFETCH=off` server env → `prefetch={false}`), `app/page.jsx` / `orders/page.jsx` / `orders/new/page.jsx` (RSC pages), `app/_client/*.jsx` (one `"use client"` boundary file per component: a single barrel put every client component into one chunk on every route — fairness fix 1), `next.config.mjs` (`compress: false`, `experimental.cpus: 2`, turbopack / tracing root = repo), `build.sh` (exit 3 = not installed).
- `rivet/` — workspace resolution. `vite.config.ts` (`rivetRouter({ styles, bridges: [react()], prefetch: "document" })`; build env `BD_PREFETCH=off` / `BD_ALL_LOAD=1` / `BD_FULL_TAIL=1` → `define`d `import.meta.env` switches + the full-tail plugin; `RIVET_RESUME_MODEL=derived` → `resume: { model: "derived" }`, routes in `.rivet-derived/`), `src/routes/_layout.tsx` (sidebar `<Link active>` from `@rivetjs/router/client`, `UserMenu` island `idle`), `index.tsx` (KPIs + recent orders in Rivet, `RevenueChart` `visible`), `orders/index.tsx` (`OrdersTable` `load`), `orders/new.tsx` (`OrderForm` `load`), `src/document.ts`, `build.ts` (Vite app builder → `BD_DIST`, default `dist`, derived `dist/derived`), `serve.ts [port]` (router node adapter `start`, `compress: false`, prints `ready`).
- `run.ts` — phases `build,server,browser,lighthouse` → `results/<stamp>.json` (or `--out`, merged per lane). `report.ts --in … --out … [--notes …]` → `.md` + `.json`.

## Lanes (ports 4451–4456)

| lane | what | port |
| --- | --- | --- |
| `rivet` | headline: idiomatic policies, document prefetch (D-lean + fetch-ahead) | 4451 |
| `rivet-all-load` | fairness control: every island `client="load"` (`dist-all-load`) | 4452 |
| `rivet-no-prefetch` | no document prefetch, links `prefetch="none"`: pure D-lean, nothing before intent (`dist-no-prefetch`) | 4453 |
| `next` | Next 16.4.0, `<Link>` prefetch on (default) | 4454 |
| `next-no-prefetch` | same build, `BD_PREFETCH=off` → `prefetch={false}` | 4455 |
| `rivet-full` | pre-D-lean baseline: `offerLean` stubbed at build (`BD_FULL_TAIL=1`) → full resume driver (`dist-full`) | 4456 |
| `rivet-derived` | derived resume model (`RIVET_RESUME_MODEL=derived`, `dist-derived`; not in the default lanes; M6-PARITY 2026-10-22 unthrottled smoke: every interaction paints like `rivet`; `/orders` HTML 153 vs 87 KB raw because the router's derived root props carry the loader data the lean island also gets) | 4457 |

## Rules / invariants

- Same component sources, data, CSS and library versions in both lanes; `run.ts` validates each route's markup (`MARKERS`) and that `/orders` carries all 500 orders (`ORD-10500`) before timing.
- Data reaches the islands as serialized props in both lanes: Rivet pages read it in `load(…)` (fairness fix 2: a module-level import resumed by reference — `_rMod` — and the client rebuilt the seed instead of receiving 500 orders).
- `NODE_ENV=production` for every build and server; no compression anywhere (gzip -6 estimates from response bodies).
- Timed phases under the host bench lock (`BD_BENCH_LOCK=<bench-lock.sh>`, lane BRIDGES, maxLoad 4; `--loaded` waives it and labels the run). One phase per invocation when a run would exceed the lock's 90-min stale limit.
- Browser "before input" window: after `load`, until nothing is in flight and no network event for 1 s (+ 500 ms). Each lane's warm-up visit (discarded from the timed medians) runs with V8 precise coverage: JS fetched vs executed + the chunk category breakdown (`CATEGORIES`, first match per chunk) come from it.
- Interactions per route (`INTERACTIONS`): `/` user menu click (idle island), chart hover (visible); `/orders` sort click, filter keystroke, row → modal, nav click → `/orders/new` painted; `/orders/new` submit → 4 inline errors. Paint = next trusted input → frame after the predicate holds (`PROBE`).

## Commands

```sh
export PATH=/Users/denisseverin/.nvm/versions/node/v26.5.1/bin:$PATH
(cd apps/bridge-demo/next && npm ci --workspaces=false --ignore-scripts)
node apps/bridge-demo/run.ts --phases build
BD_BENCH_LOCK=<bench-lock.sh> node apps/bridge-demo/run.ts --phases server --out results/run.json
BD_BENCH_LOCK=<bench-lock.sh> node apps/bridge-demo/run.ts --phases browser --conditions fast3g --out results/run.json
node apps/bridge-demo/report.ts --in apps/bridge-demo/results/run.json --out docs/benchmarks/2026-10-12-bridges-demo --notes docs/benchmarks/2026-10-12-bridges-demo.notes.md
npx nx run bridge-demo:typecheck
```

## Gotchas

- Next App Router aliases `react` to its vendored copy, so the shared components outside `next/` resolve the right React; `turbopack.root` must be the repo root for them to build.
- `rivet-full` is built, not patched at serve time: the Vite plugin in `vite.config.ts` stubs `offerLean` in `libs/bridge/lean.ts` and throws when the function is missing (rename = fix the plugin).
- `rivet-all-load` changes only the two non-`load` islands (`RevenueChart` `visible`, `UserMenu` `idle`); the chart is above the fold and idle fires inside the before-input window, so expect it close to `rivet` — it stays in every table as the control.
- `@hookform/resolvers` is nested in `apps/bridge-demo/node_modules` (not hoisted); `run.ts` reads the Rivet lane's versions there first.
- Lighthouse binary: Playwright's full Chromium if installed, else its `chromium_headless_shell-<rev>` of the same revision (only the shell is installed on this host); `BD_CHROME=<path>` overrides; the choice is recorded in `host.notes`. A crash inside a timed phase (e.g. spawn ENOENT) skips `run.ts`' cleanup: the lane servers stay up on 4451–4456 and the bench lock stays held — kill the `serve.ts` / `next-server` processes under `apps/bridge-demo` and `bench-lock.sh release BRIDGES`.
