# @rivetjs/resume-bench

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Real-Chrome resumability/hydration benchmark: the same SSR'd page (1,000 rows, counter, toggle, filter, client routing, lazy detail, visible canvas, idle analytics) in Rivet vs Qwik 1/2 and Solid 1/2. Measures load, first-input latency, JS bytes before interaction, prefetch waste, long tasks. Goal: Rivet beats every lane (open LOSE 2026-10-05: slow click/filter vs Solid 1.9.15, see `docs/benchmarks/perf-scoreboard.md`).

## Entry points

- `run.ts` — runner: `node apps/resume-bench/run.ts [--build] [--verify] [--repeats 10] [--lanes rivet,qwik,qwik-stable,solid,solid-stable] [--conditions fast,slow] [--scenarios load,click,keyClick,tapClick,hoverClick,filter,filterKey,filterSettled,navigate,scrollClick] [--no-traces] [--no-coverage]`.
- `serve.ts` — `serve(dir)`: per-lane static origin (ephemeral loopback port), brotli, no caching, 404 for `/item/*`.
- `provenance.ts` — lane definitions (`laneNames`, `isLane`), `build-manifest.json` write/read (versions, config, source + artifact hashes); stale manifests rejected.
- `stable-dependencies.ts` — resolves stable Solid/Qwik from `../bench-stable` (also imported by `apps/dom-bench/build.ts`).
- `data.ts` — `items` (1,000 `{id,label}`) + `WORDS`; shared by all lanes.
- `http2.mjs` — experimental HTTPS/1.1 vs HTTP/2 transport screen on the built rivet lane ([HTTP2.md](HTTP2.md)).

## Layout

- `lanes/<lane>/build.ts` — `export async function build(outDir)` → `outDir/index.html` (complete SSR doc for `/`) + assets; `check.ts` / `render.ts` / `src/` per framework.
  - `rivet/` — `page.tsx`, `detail.tsx` (lazy), `server.tsx` (`resumableToString` + router); Vite + `@rivetjs/compiler/vite` resume modules.
  - `solid/` (2.0.0-rc.13), `solid-stable/` (1.9.15), `qwik/` (2.0.0-rc.0), `qwik-stable/` (1.20.1).
  - `rivet-derived/` — spike S2 lane (`docs/design/research/2026-10-18-beyond-resume-hydration.md` §8): the fixture as a hand-written *derived client* — `build.ts` emits the static page + a values tail (`<script type="application/json" id="rv">`: loader data + keyed signal values, no handler / binding records, no `data-r`) + the inline loader (`src/loader.js`, holds cold events, idle `modulepreload` fetch-ahead, evaluates the slice on the first input / visible / scroll), `src/d.js` = the route slice as a compiler would emit it (per-site handlers, per-signal edit lists, O(1) list adoption, route swap keeping the list section alive), `src/detail.js` (lazy route), `src/a.js` (idle analytics). esbuild-minified, no framework runtime. Stands in for compiler output; passes `--verify`. Loader rules learned from the first run (research record §12): definitions-only modules + the values parse are evaluated at idle (first input synchronous), the lazy route chunk is in the fetch-ahead closure, the list writer has a keyed-reconcile fast path. Results: research record §12 (Chromium 141, this lane vs rivet / solid-stable / qwik-stable / solid / qwik, slow).
- `FIXTURE.md` — the DOM/behaviour contract every lane must implement + runner metric definitions.
- `.build/` (work), `dist/<lane>/` (built lanes), `results/` — all gitignored.

## Rules / invariants

- Runner only observes DOM; lanes contain **no** bench instrumentation. Same ids/classes/behaviour per `FIXTURE.md`.
- Server data reaches the browser only through each framework's own state mechanism.
- Production builds, minified, no source maps; each lane on its own origin; navigation client-side.
- Conditions: `fast` = unthrottled; `slow` = Lighthouse Slow 4G (150 ms, 1.6 Mbps down, 750 kbps up) + 4x CPU.
- Primary latency metric (round-2 B7): `paintLatency` = input timeStamp → the task after the rAF that follows the DOM change (`until` → `<name>Paint` mark; includes effects, cleanup, style/layout/paint). `latency` (first matching DOM mutation) stays as a secondary column. `versions.chrome` records the browser build (scoreboard compares it with `competitors.json` resume provenance).
- Coverage runs in every lane (symmetric overhead); only Rivet reports waste / first-input-sync metrics.
- Filter algorithm is identical in every lane (`FIXTURE.md`; 2026-10-09: the Rivet lane read + lowercased the query per row and the Qwik lanes filtered an empty query, Solid did neither — results before `2026-10-09T13` mix that asymmetry). Filter scenarios: `filter` (type `golf`, first result), `filterKey` (`g` only), `filterSettled` (`golf` until the 4th input's dispatch ended with 100 rows).
- `run.ts --build --lanes rivet --conditions slow` is the scoreboard CLI contract (`apps/dom-bench/scoreboard.ts --repo`); keep path + flags stable.
- Stable lanes resolve only through `apps/bench-stable` (no Solid 1/2 mixing).

## Commands

- Verify all lanes: `node apps/resume-bench/run.ts --build --verify`.
- Measure: `node apps/resume-bench/run.ts --build --lanes rivet,solid-stable --conditions slow --repeats 10` (stop other workloads).
- Typecheck: `node scripts/tsc.ts -p apps/resume-bench` (tsgo; or `NX_DAEMON=false npx nx run resume-bench:typecheck`). No vitest project.

## Result files

- `results/<ISO-stamp>.json` (versions, builds, table, runs, errors) + `results/traces/<run-id>/<condition>/<scenario>/<lane>-r<repeat>.json.gz` (open in DevTools Performance).
- `results/` is gitignored; runs force-tracked as evidence: `2026-10-03T13-07-11-549Z.json`, `2026-10-18T12-30-51-794Z.json` (spike S2: `rivet-derived` vs the five lanes, Chromium 141, slow, cloud host).
- HTTP/2 screen: `.artifacts/http2-bench/runs/<run-id>/results.json`.

## Gotchas

- Chrome stalls the frame after a DOM change made inside a trusted mouse `click` (~25–45 ms, main thread silent in `BeginMainFrame` until the hover-update mousemove; bare page, no framework: sync write 47–63 ms vs deferred one task 24–32). Keyboard (`keyClick`, ~1 ms) and touch (`tapClick`) don't stall. `click` alone therefore favours async handlers (Qwik); report all three. 2026-10-07 slow: mouse Rivet 59 / Solid 1 54 / Qwik 33; keyboard 11 / 10 / 27; touch 32 / 32 / 50.

- Filter paint is frame-quantized and load-sensitive (RESUME-FILTER 2026-10-11, traces): after the input task every lane's main thread sits idle ~20–45 ms until the next BeginMainFrame (PrePaint), so `paintLatency` lands bimodally (~72 / ~88 ms slow) and only the input task (`latency`, Rivet ~17 ms vs Solid 1 ~12 ms) is framework work. The 2026-10-09 "regression" (Rivet 72 → 118 ms) was host load (load ~34; Solid 1 +16, Qwik +36 in the same run); at load < 10, HEAD 3f53e0d1: filter Rivet 86.7 / Solid 1 87.7 / Solid 2 88.4 ms paint median (n=8). Later keys after `g` cost ~1 ms each; an unchanged-list bailout in `_for` and ownerless adopted rows measured no gain (patch not landed).
- `tsconfig.json` excludes `lanes/*/src` and `lanes/rivet/*.tsx` — those are type-checked only by their own builds.
- Without `--build` the existing `dist/<lane>` is measured; the runner rejects stale build manifests — rebuild after compiler/runtime changes.
- `RESUME_BENCH_CHROME=<executable>` launches that Chromium instead of the `chrome` channel (cloud containers: `/opt/pw-browsers/chromium`); results record the browser build either way.

## See also

- [FIXTURE.md](FIXTURE.md), [HTTP2.md](HTTP2.md), [../dom-bench/CLAUDE.md](../dom-bench/CLAUDE.md), [../bench-stable/CLAUDE.md](../bench-stable/CLAUDE.md), [../../docs/guides/resumability.md](../../docs/guides/resumability.md), [../../docs/benchmarks/perf-scoreboard.md](../../docs/benchmarks/perf-scoreboard.md)
