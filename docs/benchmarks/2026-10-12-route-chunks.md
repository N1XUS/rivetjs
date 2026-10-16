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
