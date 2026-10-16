# Bridges demo: same React components, less framework JS (DEMO)

Status: approved 2026-10-12, implemented (D1–D8; timed run 2026-10-12 / 13, results below). Coordinator rulings folded in below. Lane BRIDGES. Builds on `docs/design/specs/2026-10-11-framework-bridges-design.md` (T6 React adapter, T7b lean client) and the `apps/island-bench` harness.

## Goal

- Adoption story: a team with a real React 19 app moves it into Rivet without rewriting components.
- Claim (ruling 2026-10-12, replaces the original "half the JS" target): **"Same React components. Framework code executed before the first input: Next 58.3 + 6.8 KB vs Rivet 0.7 KB (lean) / 37.3 KB (full driver). Total JS executed before first input: 0.58–0.71× (lean) / 0.77–0.84× (full driver). React + your libraries are the rest."** Numbers measured in §Results; the ruling's pre-measurement estimates (~66 KB / 36 KB / ~0.6×) are replaced by them.
- "Half" (≤ 0.5× on every route) is reported as unreachable: React + TanStack / Radix + rhf / zod + recharts are most of the bytes in both lanes (per-chunk breakdown table in §Results and the demo README).
- Secondary goal: no LOSE on input-to-paint, hydration CPU, server CPU / page; Lighthouse mobile ≥ Next.
  - Input-to-paint: Fast 3G form submit was a LOSE in the 2026-10-12 run and is a TIE in the 2026-10-13 re-run (one-frame medians, §Results).
  - Met on hydration CPU and server CPU.
  - Lighthouse vs Next: score WIN (100 on every route after the 2026-10-13 LCP fix), simulated LCP WIN.

## App scope ("Ops dashboard", seeded data, no backend)

| Route | Content | Libraries |
| --- | --- | --- |
| all | sidebar nav (3 links = the 3 routes, active state), top bar with user menu | — |
| `/` | 4 KPI cards, revenue chart (12 months, tooltip, legend), "recent orders" (10 rows) | recharts |
| `/orders` | data table: 500 orders, column sort, text filter + status filter, pagination (25/page), row click → detail modal | @tanstack/react-table, @radix-ui/react-dialog |
| `/orders/new` | order form: 7 fields (text, email, select, number, date, checkbox, textarea), zod schema, inline errors, submit → success toast | react-hook-form, @hookform/resolvers, zod |

- Data: one seeded module (`data.ts`, deterministic, 500 orders + 12-month series), imported by both lanes; same CSS file (plain CSS, no Tailwind, no web fonts).
- Components: `apps/bridge-demo/components/*.react.tsx` — `OrdersTable`, `OrderModal`, `RevenueChart`, `OrderForm`, `UserMenu`; both lanes import them by relative path, unchanged.

## What stays React, what becomes Rivet

| Part | Next lane (`next/`) | Rivet lane (`rivet/`) |
| --- | --- | --- |
| layout, nav, top bar shell | RSC (layout.tsx) | Rivet components (`_layout.tsx`) |
| KPI cards, recent orders list (static) | RSC | Rivet components (no JS) |
| routing | App Router (`<Link>`, client router) | `@rivetjs/router` file routes (SSR per request, links = documents + router navigation) |
| user menu | client component | React island `client="idle"` |
| revenue chart | client component | React island `client="visible"` |
| orders table + modal | client components | React islands: table `client="load"`, modal mounted by the table (same React tree) |
| order form | client component (react-hook-form + zod) | React island `client="load"` (same component); variant later: native `@rivetjs/forms` + same zod schema ("forms where cheap", own row, not in the headline) |

## Metrics (island-bench harness, per route)

- Browser (Playwright Chromium, fresh context, lanes interleaved, Fast 3G + 4× CPU and unthrottled): bytes / JS bytes (raw + gzip est.) / JS requests before first input, script CPU until idle, CLS, first input → paint per interaction (sort click, filter keystroke, modal open, form submit with errors, chart hover, nav click → next route painted).
- Server: c1 / c10 requests/s, TTFB p50, complete p50, server CPU / page, peak RSS.
- Lighthouse 13.5.0 (root devDependency) mobile preset, 3 runs median: performance score, TBT, LCP, total JS.
- Build: wall time, peak RSS (tree, ≤ 3 GB cap).
- Report: `apps/bridge-demo/report.ts` → `docs/benchmarks/2026-10-12-bridges-demo.{md,json}`, WIN / TIE / LOSE as island-bench (≥ 1.1× and above noise floor).

## Fairness rules

- `NODE_ENV=production` for both builds and both servers (recorded in results).
- Identical component sources, data and CSS. Next 16.4.0 + React 19.3.0 pinned in both lanes (one React copy per lane), same library versions (exact pins).
- No compression in either server (Next `compress: false`, Rivet server gzip off); gzip estimate reported for both.
- Next: `next start`, App Router, RSC wherever idiomatic (static parts are server components, not client); per-request rendering (`force-dynamic`) since the Rivet lane renders per request; no artificial `"use client"` at the root.
- Rivet: production `serve-rivet`-style server. **Headline row = the idiomatic policies** listed above. **Fairness control "all `load`"** (every island `client="load"`) is reported next to it in every table, never hidden.
- Prefetch: headline = each framework's default (Next `<Link>` prefetch on; Rivet router `prefetch: "document"`). A **no-prefetch row for both lanes** is reported next to it. Prefetch bytes before the first input are also reported on their own.
- Timed runs only under the host bench lock; loaded host labelled.

## Known risks (measured, not assumed)

- File-router pages kept the full resume driver (T7b review M2: router navigation listeners record `clientEvent`s), so the Rivet lane paid the resume runtime (~37 KB gzip in the smoke breakdown) on top of React. **D-lean landed** (ruling 2026-10-12): pages whose only Rivet resumables are the router's `Router` region + intent-preloaded client events (click / pointerover / focusin on `a`, popstate) get the lean tail. Islands hydrate per their policies exactly as before; only the Rivet runtime + resume loader defer to the first link intent (pointerover / focus / click; a cold click is held and replayed, keyboard Tab → Enter navigates). State script is non-booting (`data-boot` absent), island `_hydratedRoot` effects and `_rPreload`s dropped. An eager Rivet client event or region keeps the full tail. Code: `libs/bridge/lean.ts` `tail(view, deferred)`, `libs/runtime/server-resume.ts` `DeferredState`. No Rust.
- Fetch-ahead (ruling (c)): only when the router app sets `prefetch` ≠ none (codegen `export const fetchAhead = true` → `createApp` `preload.ahead`). The deferred state carries `data-fo`: low-priority modulepreloads after load + fonts + idle, fetched and never evaluated before intent (browser test counts executed modules). Headline row = idiomatic prefetch; second row = pure lean (`prefetch` none), whose first nav pays the runtime fetch on intent (smoke Fast 3G: 3.2 s vs 1.7 s, 1 sample → timed run n ≥ 5, LOSE stated plainly).
- Report splits **JS fetched before input** vs **JS executed before input** (V8 precise coverage on the warm-up visit) for every lane; framework share table per route.
- recharts + TanStack Table + react-hook-form dominate both lanes' JS; the delta is Next's framework runtime + RSC payload vs Rivet's tail — "half" holds only if per-route JS is mostly framework. If not reachable, report the honest ratio and what dominates.
- `/orders` table hydrates 25 rows × 6 columns in React in both lanes: hydration CPU parity expected, not a win.

## Layout

- `apps/bridge-demo/{CLAUDE.md,README.md,project.json,tsconfig.json,data.ts,site.css,run.ts,report.ts}`, `components/*.react.tsx` (+ `tsconfig.json` React JSX).
- `next/`: own install (`package.json` + lock, `node_modules` gitignored): next 16.4.0, react / react-dom 19.3.0 + the libraries; `app/**`.
- `rivet/`: workspace resolution (root install), `src/routes/**`, `vite.config.ts` with `rivetRouter({ styles, bridges: [react()], prefetch: "document" })` (the router plugin's `bridges` option forwards to the compiler plugin), `serve.ts` = router node adapter (`compress: false`).
- Next client boundaries: one `"use client"` file per component (`next/app/_client/*.jsx`); plain CSS imported once in `layout.jsx`. Rivet inlines the same CSS via `rivetRouter({ styles })`.
- Lanes, ports, build switches, commands: `apps/bridge-demo/CLAUDE.md`.

## Installs (approved and done 2026-10-12)

- Libraries (exact pins, registry latest 2026-10-12): `@tanstack/react-table` 9.3.1, `react-hook-form` 7.90.0, `@hookform/resolvers` 5.9.1, `recharts` 3.10.1, `@radix-ui/react-dialog` 1.3.0; `zod` 3.25.76 already at the root.
- Shared libraries: an `apps/bridge-demo/package.json` workspace member (ruling), used by the Rivet lane.
- Next lane: own install in `apps/bridge-demo/next/` (next 16.4.0 + react 19.3.0 + the five libraries); size reported on approval.

## Tasks

- D1 spec ruling (done).
- D2 scaffold without installs: shared components as source, data seed, CSS, Rivet shell, harness wiring.
- D3 installs (on approval).
- D4 Next lane.
- D5 Rivet lane + "all `load`" control.
- D6 harness: `run.ts` reusing island-bench's server / browser phases, plus a Lighthouse phase and no-prefetch rows.
- D7 first measurement → D-lean (done: lean tail + fetch-ahead, `rivet-full` lane = pre-D-lean baseline on the same app).
- D8 timed run under bench lock (Fast 3G + unthrottled, 10 repeats interleaved) + report + notes (done).

## Fairness fixes ("what we did to be fair to Next")

1. One `"use client"` boundary per component: a single barrel put every client component into one chunk on every Next route.
2. Data as serialized props in both lanes: Rivet pages read data in `serverLoad`; a module-level import had resumed by reference (`_rMod`) and the client rebuilt the seed instead of receiving it.

## Results (timed run 2026-10-12 / 13, loaded host; browser + Lighthouse re-run 2026-10-13 after the LCP fix, under the lock at load < 4; full report `docs/benchmarks/2026-10-12-bridges-demo.md`)

JS before the first input (gzip est. KB, chunks counted once under the first category they match). Rivet = headline lane (D-lean + fetch-ahead); fetched / executed.

| chunk holds | `/` Rivet | `/` Next | `/orders` Rivet | `/orders` Next | `/orders/new` Rivet | `/orders/new` Next |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| React (react-dom + react) | 66.9 | 70.3 | 66.9 | 70.3 | 66.9 | 70.3 |
| route library (recharts / TanStack + Radix / rhf + zod) | 101.2 | 102.5 | 26.1 | 25.7 | 25.1 | 24.7 |
| use-sync-external-store + UserMenu chunk | 1.2 | 8.1 | 1.2 | 8.1 | 0.5 | 7.3 |
| framework (fetched) | 34.0 | 58.3 | 34.0 | 58.3 | 34.0 | 58.3 |
| **total fetched** | **203.4** | **239.0** | **128.3** | **162.3** | **126.5** | **160.6** |
| **total executed** | **170.1** | **239.0** | **95.0** | **162.3** | **93.2** | **160.6** |

- Executed vs Next: 0.71× / 0.58× / 0.58×. Fetched vs Next: 0.85× / 0.79× / 0.79×. Full driver (pre-D-lean), executed: 0.84× / 0.77× / 0.77×.
- Framework code executed before input:
  - Next: 58.3 KB, plus 6.8 KB of client-router code in its user-menu chunk.
  - Rivet D-lean: 0.7 KB. Rivet full driver: 37.4 KB.
- "Half" is unreachable: React + the route's libraries alone are 0.71× / 0.58× / 0.58× of Next's total.
- Pure lean (prefetch none): fetched = executed = 169.4 / 94.3 / 92.5 KB. Its first nav is a **LOSE**: Fast 3G 3,284 vs 1,727 ms against next-no-prefetch (1/1.90×, n = 10). With prefetch on (the headline) the first nav is a TIE: 1,793 vs 1,731 ms.
- Other LOSEs:
  - JS requests before input: 15 vs 7. Most are fetch-ahead modulepreloads that never run.
  - Fast 3G form submit → errors: 60.1 vs 49.8 ms in the 2026-10-12 run; TIE (59.6 vs 60.4 ms) in the re-run — one-frame medians.
  - Unthrottled first nav in the re-run: 49.8 vs 37.2 ms, bimodal one frame apart for `rivet-full` too (2026-10-12: 37.1 vs 37.6).
  - HTML gzip est.: inlined CSS + island records.
  - Peak server RSS on `/orders` c10: 615 vs 493 MB.
- Lighthouse vs Next (after the 2026-10-13 LCP fix): score WIN, 100 / 100 / 100 vs 81 / 84 / 96.
  - Simulated LCP WIN 3.2–5.7× (923 / 1,224 / 902 vs 5,255 / 4,557 / 2,852 ms; Next's `/orders/new` was 4,106 ms in the 2026-10-12 run): Lighthouse mobile preset, Playwright headless shell, n = 3.
  - Observed LCP vs Next was not measured.
- Lighthouse vs the full driver: TIE on `/` and `/orders`; `/orders/new` LOSE 902 vs 771 ms (1/1.17×), both scoring 100.
  - Superseded (2026-10-12, before the fix): simulated LCP 2.6–4.6× worse, scores 83–92 vs 100. Cause: high-priority `<link rel="modulepreload">` of the `load` islands' React chunks in the lean HTML (`/orders/new`), and fetch-ahead + an in-viewport `visible` island's import starting before the first paint was presented (`/`). Lantern counts every request started before the observed FCP / LCP.
  - Fix (lean boot + loader, spec `2026-10-11-framework-bridges-design.md` §3.12): no link tags; the boot preloads and imports only after the first `paint` performance entry + idle (fallbacks: no entry type → idle alone, 1 s after `load` at the latest, a first pointerdown / keydown opens it); the loader's fetch-ahead waits for the same entry (same cap). `fetchpriority="low"` was measured too and did not help. Input-to-paint and hydration CPU unchanged; inline boot +174 B min / +102 B gzip vs before the fix (gate + its fallbacks).
  - Details: benchmark notes.
- Server CPU / page: 2.0–4.9× lower at c1, 2.1–5.6× at c10. TTFB: 2.2–4.8× lower at c1, 2.4–6.8× at c10. Conditions: per-request SSR, no compression, localhost, loaded host. Hydration script CPU: WIN on every route (Fast 3G `/`: 159 vs 986 ms).
