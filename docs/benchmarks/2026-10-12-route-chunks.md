# Route chunks vs component chunks (ROUTE-CHUNKS, 2026-10-12)

Question: can `resume.chunks: "route"` (+ merge) give hydration-like request counts (≤ 3–5 JS requests before first input) with zero execution before the first event? Raw rows: `2026-10-12-route-chunks.json`.

## Method

- Apps: ui-docs example frames (`select-default`, `date-picker-basic`, `combo-box-default`), bridge-demo `/orders` + `/orders/new`, starter `server` home. Production client builds from a snapshot of the working tree; chunking set per build.
- Probe (Playwright Chromium, cold context per page, local HTTP/1.1 static server, unthrottled): JS requests + gzip bytes until 3 s without JS ("before input"), modules evaluated (served JS prefixed with an evaluation probe), then click on the trigger → popup visible (ms) + JS the click added.
- Timed A/B (`comp-on` vs `route4-on`, n = 5 interleaved, 2026-10-13; host load 1-min 3.98 → 3.30, 5-min 4.51 at start): see "Timed cold click" below. Click times in the first table are n = 1, unthrottled.

## Results (ui-docs frames, before input: JS requests / gzip KB / modules evaluated; click: ms / JS requests added / gzip KB)

| Build | select-default | date-picker-basic | combo-box-default |
| --- | --- | --- | --- |
| component, merge 2048 (default) | 77 / 155 / 77 · 111 ms, +2 / 0.7 KB | 61 / 180 / 61 · 116 ms, +31 / 19.8 KB | 76 / 156 / 76 · 94 ms, +15 / 8.5 KB |
| component, merge off | 126 / 167 / 126 · 111 ms | 100 / 188 / 100 · 144 ms | 123 / 167 / 123 · 115 ms |
| component, merge 16384 | 58 / 152 / 58 · 107 ms | 39 / 176 / 39 · 138 ms | 52 / 153 / 52 · 165 ms |
| component, merge 65536 | **49 / 152** / 49 · 97 ms | **29 / 175** / 29 · 136 ms | **44 / 155** / 44 · 112 ms |
| group, merge 2048 | = component (frames have no `ChunkGroup`) | = | = |
| route, HEAD (before fix) | 380 / 1030 / 380 · 122 ms, +257 / 145 KB | 0 / 0 · 266 ms, +737 / 1228 KB | 70 / 151 · 253 ms, +519 / 1005 KB |
| route + barrel reach + per-set shared | 77 / 162 / 77 · 109 ms, +0 | 0 / 0 · 166 ms, +79 / 202 KB | 75 / 153 · 114 ms, +13 / 18 KB |
| route + fetch-ahead (final) | 76 / 162 / 76 · 116 ms, **+0** | 78 / 202 / **1** · 147 ms, **+0** | 87 / 171 / 74 · 131 ms, **+0** |

Other apps (before input: JS requests / gzip KB / evaluated):

| App | component | route (final) |
| --- | --- | --- |
| bridge-demo `/orders` | 15 / 131 / 0 | **10** / 132 / 0 |
| bridge-demo `/orders/new` | 14 / 129 / 0 | **9** / 130 / 0 |
| starter `server` home | 0 / 0 / 0 | 0 / 0 / 0 |

Build output (ui-docs client): component 6,378 JS files (3,574 resume chunks, largest 87 KB); route HEAD 4,015 (1,312; `resume-route_main` 727 KB = the whole `@rivetjs/ui` library: barrel imports reached no route); route final 4,227 (1,504; `route_main` 94 KB, largest `themes_tsx` 228 KB).

## Timed cold click (median of 5, click on the trigger → popup visible)

Fast 3G = 562.5 ms RTT, 1.44 Mbit/s, 4× CPU. `after` = click once no JS arrived for 3 s; `now` = click at the `load` event. Under Fast 3G both modes clicked before any preload or fetch-ahead had started (0 JS before input), so they measure a fully cold click; the route gain there comes from fewer, larger chunks on HTTP/1.1, not from fetch-ahead.

| Condition | Page | component ms | route ms | delta | click JS (comp / route) |
| --- | --- | --- | --- | --- | --- |
| h1 fast3g after | combo-box | 9891 | 9390 | **-501** | 91 / 87 |
| h1 fast3g after | date-picker | 10400 | 8948 | **-1452** | 92 / 78 |
| h1 fast3g after | select | 8902 | 8397 | **-505** | 79 / 76 |
| h1 fast3g now | combo-box | 9897 | 9396 | **-501** | 0 / 0 |
| h1 fast3g now | date-picker | 10406 | 9038 | **-1368** | 0 / 0 |
| h1 fast3g now | select | 8899 | 8405 | **-494** | 0 / 0 |
| h1 none after | combo-box | 121 | 121 | **+0** | 15 / 0 |
| h1 none after | date-picker | 142 | 139 | **-3** | 31 / 0 |
| h1 none after | select | 109 | 105 | **-4** | 2 / 0 |
| h2 fast3g after | combo-box | 3872 | 3865 | **-7** | 109 / 100 |
| h2 fast3g after | date-picker | 4508 | 4493 | **-15** | 114 / 90 |
| h2 fast3g after | select | 3876 | 3874 | **-2** | 98 / 87 |

- HTTP/1.1 Fast 3G: route −494 to −1,452 ms (select −505, date-picker −1,452 / −1,368, combo-box −501).
- HTTP/2 Fast 3G: equal (−2 to −15 ms).
- Unthrottled, after preloads: equal (−4 / −3 / 0 ms); route's click downloads 0 JS (component 2 / 31 / 15).
- No cold-click regression for route on any page or condition.

## Findings

- Route mode was broken for library apps: imports through `.ts` barrels (`@rivetjs/ui` `index.ts` `export *`, component `index.ts` `Object.assign` compounds) were not followed by the reach walk, so every library component landed in `route:main`. Fixed (`vite.ts` `exportLeaves` + `groupComponents(…, through)`), plus one shared chunk per set of roots (`route:shared:<hash>`) instead of one global `shared`.
- Fixed route mode ≈ component on requests before input (76–87 vs 61–77), +4–12 % gzip bytes; with fetch-ahead the first click downloads nothing (0 extra JS). Fetch-ahead chunks are never evaluated (date-picker: 78 fetched, 1 evaluated = the loader module); scheduled preloads (`data-preload` eager / idle / visible) still evaluate at idle in both modes: select 76 (component 77), combo-box 74 of 87 (component 76).
- No grouping reaches ≤ 5 requests on ui-docs frames: the requests are the static import closure of the handlers (cdk + ui modules), split by the bundler per owner set. The merge budget is the lever: 65536 cuts 77 → 49 / 61 → 29 / 76 → 44 at flat or lower bytes.
- Click latency: the n = 1 unthrottled gap (date-picker 147 vs 116 ms) was noise; n = 5: 139 vs 142 ms. Fetch-ahead under a slow network is still unmeasured: on Fast 3G the probe clicked before any idle download started.

## Decision

- Default stays `chunks: "component"` (merge 2048): route does not meet ≤ 5 requests anywhere. It does not regress the cold click (h1 Fast 3G −0.5 to −1.5 s, h2 / unthrottled equal), so it stays the recommendation for route-shaped apps. Per-app-shape recommendation in `apps/docs/content/guides/performance/chunks.md` "Which one to pick".
- Route mode kept usable: barrel reach, per-set shared chunks, fetch-ahead (`data-fo`, never evaluated) when document prefetch is on.

## Open

- Fetch-ahead on a slow network: click after the idle downloads finished (Fast 3G; needs a longer quiet window in `probe.mjs`).
- Raise the default merge budget (16 K / 64 K cut requests 25–50 % at flat bytes here)? Needs the docs-site byte distribution (p90 / max) like `2026-10-12-preload-group.md` before changing.

## Follow-up (M1 T2, 2026-10-18, derived-client plan `docs/design/plans/2026-10-18-derived-client.md`)

Probe: `apps/resume-bench/spikes/frames-probe.ts` (Chromium 141, cloud container, 4 cores; CDP Slow 4G + 4× CPU; JS requests / KB / modules evaluated before input = 3 s idle after `load`; first click: requests + KB it adds, latency to the first DOM change; medians of 3). Builds: `node libs/docs-kit/cli.ts build apps/ui-docs --no-checks --no-search --dist <dir>` with the env overrides of `apps/ui-docs/vite.config.ts`. Clicks: select trigger, date-picker trigger, combo-box trigger, dashboard period segment "7 days". Numbers are not comparable with the 2026-10-12 table (different host, throttled, content-length bytes instead of gzip).

| Build | select-default | date-picker-basic | combo-box-default | showcase-dashboard |
| --- | --- | --- | --- | --- |
| component, merge 2048 (default) | 79 / 144.6 KB · click +2 / 1.1 KB, 16 ms | 63 / 161.5 · +31 / 21.3, 28 | 78 / 143.3 · +15 / 9.5, 32 | 29 / 68.7 · +50 / 62.7, 19 |
| component, merge 262144 | 48 / 141.8 · +2 / 1.1, 12 | 24 / 146.5 · +40 / 30.2, 29 | 41 / 147.3 · +15 / 9.8, 29 | 22 / 116.0 · +52 / 59.2, 19 |
| route, merge 64 K / 256 K / 1 M (per-set shared chunks) | build crash (below) | | | |
| route, merge 2048, placed parts (no lazy-owned registry yet) | 91 / 211.2 · +42 / 26.7, 13 | 88 / 243.9 · +24 / 13.2, 56 | 97 / 167.6 · +45 / 76.0, 40 | 101 / 150.0 · +52 / 82.9, 69 |
| route, merge 65536, placed parts, registry lazy-owned | 35 / 185.0 · **+0**, 15 | 37 / 227.4 · **+0**, 77 | 44 / 194.1 · **+0**, 37 | 66 / 188.7 · **+0**, 56 |
| route, merge 65536, cap 3 | 27 / 304.7 · +32 / 154.5, 19 | 58 / 224.4 · +60 / 142.0, 91 | 58 / 146.9 · +58 / 196.6, 94 | 66 / 359.0 · +62 / 211.7, 69 |
| route, merge 262144, cap 2 | 26 / 106.2 · +30 / 166.1, 30 | 61 / 215.0 · +46 / 84.1, 66 | 60 / 149.7 · +46 / 185.5, 76 | 64 / 156.7 · +41 / 162.8, 29 |
| route, merge 65536, merge policy fixes (small barrels, css, hub pass) | 27 / 178.6 · **+0**, 12 | 27 / 220.5 · **+0**, 113 | 30 / 186.0 · **+0**, 38 | 47 / 176.9 · **+0**, 43 |
| route, merge 65536, + hub threshold relative to the most-shared group (landed) | 24 / 177.5 · **+0**, 16 | 25 / 219.7 · **+0**, 111 | 26 / 184.6 · **+0**, 37 | 43 / 175.5 · **+0**, 29 |
| route, merge 262144 (same policy) | 18 / 179.1 · **+0**, 11 | 19 / 234.6 · **+0**, 132 | 21 / 194.4 · **+0**, 33 | 40 / 180.1 · **+0**, 29 |

- **Route mode did not build** at ui-docs scale (1,036 lazy frames; 1,500 symbol chunks of which 193 `route:shared:<set>` chunks, the largest set 1,036 roots; `merge` off too): Rolldown 1.2.12's `rolldown-worker` thread overflows its 2 MB stack in a ~5,150-frame recursion (gdb: one repeating frame inside the binding; SIGSEGV after ~45 s), Rolldown 1.2.14 ran past 8.7 GB RSS instead (killed), a 256 MB `RUST_MIN_STACK` was killed at 16 GB. Folding every shared set into `route:main` (one shared chunk) builds in 3 min — the per-exact-set shared entries are the trigger — but that chunk is 908 KB (everything two or more frames share). First fix tried: cluster the shared symbol sets up front (`coLoadGroups` over root sets, `merge` budget then `cap` per route). It built (42 shared chunks) but was closure-blind: a merged symbol chunk drags every member's import closure and lazy imports along — unthrottled, the select frame fetched 336 files / 896 KB before input and the click prefetched 569 more (every example's lazy route). Landed fix (commit `80c4418`): shared modules are no chunks of their own; one part module per file, imported for its side effect by every route chunk reaching it, placed by the bundler by the routes using it and merged at buildEnd on the real module graph; parts register their symbols (`_rSym`, `@rivetjs/runtime/resume-symbols`) so placed chunks need no stable export names.
- **Merge policy fixes** (commits `b708fdc`, `9c98f7d`): at 64 K, 17 of the select frame's 35 files were 0.1–2 KB chunks. Two leaks in `coLoadGroups`: the owner walk stopped at every barrel, so modules reached only through a component's own `index.ts` (every ui `*.styles.ts` + `.css` pair) had no owners and were never grouped; and widely shared tiny helpers (`live.tsx` 1,020 routes, `shorthand.ts` 741, `resume-symbols` 1,184 …) were never candidates because they are not import-adjacent. Now the walk goes through barrels of ≤ 4 imports, `.css` modules and Vite's preload helper are groupable, and a hub pass merges groups loaded by ≥ a quarter of the owners of the most-shared group with each other under the same budget. Found with `RIVET_MERGE_DUMP` + `libs/compiler/spikes/merge-replay.ts` (per-module reason) instead of rebuilding.
- **Curve** (route, placed parts, policy fixes; files before input / KB; the click adds 0 files everywhere): 64 K → 24 / 25 / 26 / 43 files at 178 / 220 / 185 / 176 KB; 256 K → 18 / 19 / 21 / 40 at 179 / 235 / 194 / 180 KB. Against component + 2 K through the first click (baseline files + click files; KB likewise: 81 / 146 KB, 94 / 183, 93 / 153, 79 / 131): route 64 K is −70 / −73 / −72 / −46 % files at +22 / +20 / +21 / +34 % bytes; 256 K −78 / −80 / −77 / −49 % files at +23 / +28 / +27 / +37 %. The remaining files are the route's distinct owner-set groups of the ui / cdk graph (select at 256 K: 4 runtime + symbol files, 3 tiny shared helpers, 11 merged groups of 1–44 KB); merging those costs more than 256 KB per request saved — they are used by few routes in common.
- **Gate**: "≤ 5 JS requests before input at ≤ +30 % bytes" is not met by any point and is not reachable with singleton modules on this site (1,036 frames sharing one component library): ≤ 5 files means per-page bundles (duplicated library code, no cross-page caching) or the bytes of a page's whole library subset. The measured frontier is 18–26 files on widget frames (40 on the dashboard) at +20–28 % bytes through the first click, with the first click downloading nothing. Proposed revised M1 gate: ≤ 25 files (widget frames) / ≤ 45 (dashboard) at ≤ +30 % bytes through the first click, click +0 — which route + 64 K meets.
- **Placed parts, merge 2048** (row above): the route closure fetch-ahead is 91–101 files, 64 of them 0.2–6 KB single-owner-set chunks the 2 KB budget leaves alone (merged chunks: 22 / 119 KB; symbol chunks 5 / 11 KB), and on Slow 4G it is still in flight at 3 s (the click "adds" the rest). The click also prefetched every example (880 files / 696 KB unthrottled): the frame route's closure holds the example registry (`src/generated/example-frames.tsx`, 1,000 `import()`s) → `DOCS_LAZY_OWNED` (`rivetRouter({ resume: { lazyOwned } })` in the docs apps) from the next build on. The same scan took the build past 10 GB (per-(chunk, dynamic) module walks with a `getModuleInfo` each; memoized per chunk).
