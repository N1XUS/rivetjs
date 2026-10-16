## Notes (hand-written, appended by `report.ts --notes`)

### Run (2026-10-12 / 13)

- Host: Apple Silicon, Node 26.5.1. All six lanes were interleaved. Server: 3 rounds × 5 s per lane, route and concurrency. Browser: 10 timed repeats per lane, route and condition, plus one warm-up visit with V8 coverage.
- Bench lock: each phase took it after the 45-min wait for load < 4 had expired (coordinator ruling), so the run is labelled **loaded host** (maxLoad waived).
  - Load when the lock was taken: 4.25 (server), 6.88 (browser Fast 3G), 4.24 (browser unthrottled).
  - The 1-min load during the browser samples was 2.3–6.3 (logged per sample).
  - Compare ratios, not absolute times.
- The Fast 3G "before input" window uses the fixed harness rule: after `load`, nothing in flight and no network event for 1 s. The smoke numbers in the spec came from the old rule and are superseded by this run.
- Results: `apps/bridge-demo/results/2026-10-12-demo.json` (gitignored). Builds ran outside the lock.
- **Re-run 2026-10-13 (LCP fix, lean boot paint gate):** the browser (Fast 3G + unthrottled) and Lighthouse phases were re-run for every lane after the fix, each under the bench lock at load < 4 (3.87, 3.64, 3.89). Those rows replace the 2026-10-12 ones. The server rows are still the 2026-10-12 loaded-host run (the change only drops `<link rel="modulepreload">` tags from the lean HTML), so the Host line keeps the loaded label.
  - The working tree also carried another lane's uncommitted cold-click replay change in `resume-loader.ts` (all Rivet lanes alike; it only runs on a cold click).

### Headline (ruling 2026-10-12): same React components, less framework JS

- **Same React components.** Framework code that runs before the first input, measured as gzip est. of executed chunks:
  - Next: 58.3 KB in framework chunks. Next's user-menu chunk adds another 6.8 KB over Rivet's (7.3 vs 0.5 KB; it bundles client navigation code), so ≈ 65 KB on top of React.
  - Rivet (headline lane, D-lean): 0.7 KB.
  - Rivet with the full resume driver (`rivet-full`): 37.4 KB fetched (top-level code ran for 20 of its 22 scripts).
- **JS executed before the first input vs Next:**
  - D-lean: 0.71× on `/`, 0.58× on `/orders`, 0.58× on `/orders/new`.
  - Full driver: 0.84×, 0.77×, 0.77×.
- **JS fetched before the first input** (headline lane: the fetch-ahead modulepreloads are fetched but never run): 0.85×, 0.79×, 0.79×.
  - Pure lean (`rivet-no-prefetch`: nothing fetched before intent): 0.71×, 0.58×, 0.58×.
- React and your libraries are the rest. They are the same bytes in both lanes, within 1.3 KB per category; Next ships its own React build, 70.3 vs 66.9 KB.
- **"Half the JS" is unreachable on this app.** Even with zero framework bytes, the floor is React + the route's libraries:
  - 169 KB on `/` against Next's 239 KB (0.71×);
  - 94 KB on `/orders` against 162 KB (0.58×).
  - recharts alone is 101 KB on `/`.
  - The per-chunk breakdown tables above give the split per route.

### Fetch-ahead (ruling (c)) and the pure-lean nav LOSE

- **Headline row** = idiomatic prefetch (`rivetRouter({ prefetch: "document" })`). The deferred state carries `data-fo`: low-priority modulepreloads of the runtime + router chunks after `load`, fonts, the first paint and idle, never evaluated.
  - Fetched vs executed on `/orders`: 128.3 vs 95.0 KB, 15 vs 5 scripts.
  - The first nav click is then on par with Next on Fast 3G: 1,793 vs 1,731 ms (TIE).
  - Unthrottled it reads LOSE in the 2026-10-13 run: 49.8 vs 37.2 ms (1/1.34×). The samples are bimodal, one frame apart (≈ 35 or ≈ 50 ms), for `rivet-full` too (45.1 ms), which the lean-boot change does not touch. The 2026-10-12 run had 37.1 vs 37.6 ms. Treat it as frame quantization until a larger n says otherwise.
- **Second row = pure lean** (`prefetch` none): nothing beyond the islands loads before intent.
  - Fetched = executed: 94.3 KB, 4 scripts on `/orders`.
  - **LOSE on the first navigation:** Fast 3G 3,284 vs 1,727 ms against next-no-prefetch (1/1.90×, n = 10); unthrottled 50.5 vs 37.4 ms (1/1.35×).
  - Cause: the runtime + router chunks are fetched on the click itself. Next without prefetch still has its router loaded.
  - That is the trade the `prefetch` setting controls. The default document prefetch keeps the nav at parity.
- The headline lane's JS requests before input are a LOSE: 15 vs 7 on `/` and `/orders`, 14 vs 6 on `/orders/new`. Most of them are the small fetch-ahead modulepreloads at low priority after load (10 of the 15 never run).
  - The pure-lean lane is 4 / 4 / 3 requests (WIN 1.75–2×).
  - Grouping the runtime fetch-ahead into fewer chunks would close this; that is a separate change.

### Other losses (stated plainly)

- **Form submit → errors, Fast 3G, `/orders/new`:** TIE in the 2026-10-13 run, 59.6 vs 60.4 ms. The 2026-10-12 run read LOSE, 60.1 vs 49.8 ms (1/1.21×), with Next in the low mode.
  - Same React code in both lanes after hydration. The Fast 3G medians of the six lanes span 58–61 ms now and 50–62 ms then, about one frame: frame quantization, as island-bench saw on its counter. The json keeps medians only.
- **Page bytes:** gzip est. of the HTML is larger on every route. `/orders/new`: 6.0 vs 2.3 KB.
  - Rivet inlines the site CSS (`rivetRouter({ styles })`) plus island records + inline boot. Next links its CSS as a separate file and streams the RSC payload inline.
  - On `/orders` the totals are close (85 vs 90 KB raw): Next's inline RSC payload is 83 KB of script, against Rivet's 7 KB of inline JS.
- **Peak server RSS on `/orders`, c10:** 615 vs 493 MB (1/1.25×). Per-request work is still 2.1× cheaper (CPU / page 1.39 vs 2.92 ms) and TTFB is 2.4× faster.
  - The server process serves the routes in order. The 615 MB peak on `/orders/new` probably carries over from `/orders` c10, but that is not proven: the all-load and full lanes read 497 / 520 MB on `/orders/new` c10, and Next drops from 493 to 425 MB.
  - The tally keeps all three RSS LOSEs. They are one suspected cause, counted three times. RSS is measured on one server process across the routes in order, not per route.
  - Under investigation: the 500-row page buffered for 10 concurrent requests.
- **Unthrottled filter keystroke, `/orders`:** the 2026-10-13 run has the headline lane at LOSE, 14.0 vs 10.8 ms (1/1.30×), and the all-load control at WIN (7.0 ms). The 2026-10-12 run had it the other way round (6.6 TIE, all-load 11.7 vs 4.6 LOSE). These are 5–15 ms medians that swap between runs: noise at this n, counted as the report counts them.

### Lighthouse (simulated slow 4G + 4× CPU): WIN vs Next, TIE vs the full driver after the LCP fix (2026-10-13)

- Lighthouse's simulated metrics: mobile preset, Playwright headless shell (no full Chromium on the host; `run.ts` falls back to it), n = 3 per lane and route, medians.
- **After the fix** (this report's table):
  - Scores 100 / 100 / 100 vs Next 81 / 84 / 96.
  - Simulated LCP: 923 vs 5,255 ms on `/`, 1,224 vs 4,557 ms on `/orders`, 902 vs 2,852 ms on `/orders/new` (WIN 5.7× / 3.7× / 3.2×). The lean lane's rows are the fix-round re-run (paint-gate fallbacks, n = 3, lock at load 3.91); the other lanes' rows are from the run before it.
  - Next's own `/orders/new` simulated LCP moved from 4,106 ms (2026-10-12) to 2,852 ms (2026-10-13; samples 3,959 / 2,703 / 2,852): the 3.2× rests on the new, lower value.
  - Against the full driver (`rivet-full`): TIE on `/` (923 vs 920) and `/orders` (1,224 vs 1,222). `/orders/new` is still LOSE, 902 vs 771 ms (1/1.17×), score 100 for both: the `load` island's React vendor chunk + `OrderForm` now start right after the first paint (diagnosis run: 41–57 ms vs observed FCP 32–41 ms), still close to the observed LCP, while the full driver reaches them only after `resume-entry`.
- **Superseded rows (2026-10-12, before the fix):** scores 83 / 88 / 92; simulated LCP 4,201 / 3,152 / 2,702 ms; vs `rivet-full` 1/4.57×, 1/2.58×, 1/3.49×.
- **Cause** (diagnosis: one Lighthouse run per lane, headless shell; Lantern counts every request started before the observed FCP / LCP into the simulated graph, whatever its priority):
  - `/orders/new`: the lean HTML carried `<link rel="modulepreload">` for the `load` islands' chunks + their `deps` (React vendor + `OrderForm`), fetched at high priority during parse: simulated FCP 1.74 vs 0.70 s, observed LCP 45 vs 38 ms.
  - `/` (the fetch-ahead lane at 4.2 s vs pure lean 0.9 s): on this fast lab load, `load` and an idle slice come before the first paint is presented. The fetch-ahead modulepreloads (`data-fo`) and the in-viewport `visible` chart island's import then start before the observed FCP. Same fix.
- **Options measured** (same lock window, n = 3; the HEAD lean tail = `rivet-old`):

  | lane | `/` LCP (ms) | `/orders` LCP | `/orders/new` LCP | scores |
  | --- | ---: | ---: | ---: | --- |
  | HEAD (`rivet-old`) | 4,202 | 3,151 | 2,702 | 83 / 88 / 92 |
  | (A) `fetchpriority="low"` on the link tags | 4,203 | 3,003 | 2,852 | 83 / 94 / 96 |
  | (B) after the first paint (shipped) | 922 | 1,223 | 925 | 100 / 100 / 100 |
  | full driver (`rivet-full`) | 921 | 1,220 | 772 | 100 / 100 / 100 |

  - (A) does not help: Lantern counts low-priority requests too.
  - A `requestAnimationFrame` gate (first try of (B)) was bimodal (`/orders/new` 0.9 or 2.9 s): rAF + idle still ran before the frame was presented on the headless shell.
- **The fix (B):** no link tags in the lean HTML. The records carry the prefetch closure for every policy except `interaction` / `media:`, and the boot waits for the first `paint` performance entry + one idle slice before any preload or island import. The resume loader's fetch-ahead (`fetchOnly`) waits for the same paint entry.
  - Fallbacks (review fix round), so an island always mounts: no `paint` entry type or no `PerformanceObserver` → the idle slice alone; a page that never paints contentfully (Safari / Firefox emit only `first-contentful-paint`) → 1 s after `load` at the latest; a first pointerdown / keydown opens the gate at once. Lean-lane Lighthouse with them: 923 / 1,224 / 902 ms, scores 100 (the cap never fires before the observed FCP on the lab load).
- **Input-to-paint and hydration CPU unchanged** (Fast 3G, n = 10, before → after the fix; rows from the same build for HEAD / (A)):
  - nav click → `/orders/new` painted: HEAD 1,789 / (A) 1,788 / (B) 1,793 ms (2026-10-12: 1,793);
  - form submit → errors: 55.3 / 54.4 / 59.6 ms (one frame apart; Next 60.4 in the same run);
  - script CPU until idle (hydration): `/` 157.8 / 153.4 / 152.9 ms, `/orders` 72.2 / 72.6 / 71.4, `/orders/new` 42.1 / 41.4 / 41.6.
- **Bytes:** the inline boot is +174 B minified, +102 B gzip, +80 B brotli (1,705 / 957 / 790 B; the paint gate alone was +28 / +15 / +16, its fallbacks add the rest). With the link tags gone and the `load` records carrying their prefetch list, the lean HTML (raw, boot included) changes by +174 B on `/`, +83 B on `/orders`, +114 B on `/orders/new`. The loader module gains the paint wait (a separate chunk, fetched only with the deferred state).
- Not fixed here: the headless shell is not the full Chrome build, and other routes / apps with a large LCP image may still differ.

### Fairness: what we did to be fair to Next

1. **One `"use client"` file per component** (`next/app/_client/*.jsx`). A single barrel put every client component into one chunk on every route.
2. **Data as serialized props in both lanes.** Rivet pages read their data in `serverLoad`. A module-level import had resumed by reference and rebuilt the 500-order seed on the client.
3. **Same component sources, CSS, data and library pins.** Validated per route before timing, and each lane's versions are recorded in the header.
4. **`NODE_ENV=production` everywhere, no compression in either server.** Next ran `next start` with RSC for the static parts and `force-dynamic` (Rivet renders per request too).
5. **Controls shown next to the headline** in every table:
   - all-`load` islands (`rivet-all-load`): tallies within two of the headline;
   - no-prefetch rows for both frameworks;
   - the pre-D-lean full driver (`rivet-full`).

### Server

- Conditions: per-request SSR, no compression, localhost load generator, loaded host.
- CPU / page vs Next, as the server process tree's CPU delta / requests (3 rounds × 5 s):
  - c1: 4.5× (`/`), 2.0× (`/orders`), 4.9× (`/orders/new`), so 2.0–4.9×;
  - c10: 5.6× / 2.1× / 5.1×, so 2.1–5.6×.
- TTFB vs Next: c1 4.4× / 2.2× / 4.8× (2.2–4.8×); c10 6.2× / 2.4× / 6.8× (2.4–6.8×).
- D-lean vs the full driver on the server: TIE on every row (CPU / page 0.22 vs 0.21 ms on `/`). Choosing the lean tail costs nothing measurable.
