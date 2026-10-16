# Resume-bench fixture contract

Every lane (rivet, qwik, solid, qwik-stable, solid-stable) renders the same page with the same DOM ids/classes and behavior.
The runner only observes DOM; lanes contain no bench instrumentation.

## Data

`apps/resume-bench/data.ts` exports `items` (1,000 rows `{ id, label }`) and `WORDS`. Server data;
it must reach the browser through each framework's own state mechanism (serialized props/state).

## Page `/` (SSR'd, then resumed/hydrated)

- `<header id="bar" style="position:sticky;top:0;background:#fff">`
  - `<button id="inc">+</button>` increments `<output id="count">` (starts `0`).
  - `<span id="scrolled">` text `top`, becomes `scrolled` when `window.scrollY > 100` (window `scroll`
    listener, passive; back to `top` when ≤ 100).
- `<button id="toggle">toggle</button>` switches `<div id="panel">` between `<p id="closed">closed</p>`
  (initial) and `<p id="open">open <b>{count}</b></p>` (a structural region that reads the counter).
- Route region (`/` = list, `/item/:id` = detail), client navigation with `history.pushState`, `popstate`
  handled:
  - List: `<input id="filter" type="search">`; `<ul id="rows">` keyed list of items whose label includes the
    filter text (case-insensitive). Same filter algorithm in every lane (2026-10-09): `q = query.toLowerCase()` once per
    update, the original items array for an empty `q`, else `items.filter((it) => it.label.toLowerCase().includes(q))`. Row: `<li class="row" data-id="{id}">` (+ class `sel` when selected)
    containing `<a class="open" href="/item/{id}">{label}</a>` and `<button class="pick">pick</button>`
    (sets the selected id). Filter state and selection survive navigation away and back.
  - Detail: lazily loaded component/chunk: `<article id="detail"><h2>{label}</h2><a id="back" href="/">back</a></article>`.
    Link clicks (plain left click) navigate client-side; no document reload.
- `<canvas id="chart" width="300" height="150">` after the list: drawn by a browser-only effect when it
  becomes visible (fill a bar per first 10 items); sets `data-drawn="1"` on the canvas.
- Idle browser-only effect (gtag-style): `(window.__analytics ??= []).push(["pageview", location.pathname])`
  once at idle; again on each client navigation.

## Lane build contract

- `apps/resume-bench/lanes/<lane>/build.ts` exports `async function build(outDir)`.
- Produces `outDir/index.html` (complete SSR document for `/`) plus assets referenced with base `/`.
- Production builds, minified, no source maps. Each lane is served on its own origin; the server
  answers `/item/*` with 404 (navigation must be client-side).
- `apps/resume-bench/lanes/<lane>/` holds that lane's sources; shared data from `../../data.ts`.

## Runner metrics beyond DOM timing (`run.ts`)

- Latency to paint (primary, round-2 B7): `paintLatency` = input `timeStamp` → a `MessageChannel` task posted from the `requestAnimationFrame` after the scenario's DOM condition first holds, i.e. the frame that renders the update (effects, cleanup, style, layout, paint) has run. `latency` = input → first DOM mutation satisfying the condition (secondary).

- Filter scenarios (the 100 rows of `golf` already hold after `g`): `filter` = type `golf`, first keydown → first DOM
  mutation leaving 100 rows (`latency`) / the frame after it (`paintLatency`; later keys may still queue before that
  frame); `filterKey` = type `g` only (first result alone); `filterSettled` = type `golf`, first keydown → the 4th
  trusted `input` finished its dispatch (window bubble listener) with 100 rows shown (re-checked on DOM changes, so a
  lane updating after the dispatch is waited for) / the frame after it. Caveat: a lane that processes an input
  asynchronously and leaves the same 100 rows (Qwik) settles at the dispatch end, before its own late work.
- Traces: one Chrome trace per lane/scenario/condition/repeat → `results/traces/<run-id>/<condition>/<scenario>/<lane>-r<repeat>.json.gz` (CDP `Tracing`, gzip stream; load in DevTools Performance). Categories = DevTools timeline minus the JS sampling profiler (overhead under 4× CPU). All lanes. `--no-traces` skips.
- Coverage: V8 precise coverage (`callCount`, function granularity) runs in every lane so its overhead is symmetric; only Rivet reports from it. `--no-coverage` skips (waste metrics then absent).
  - Snapshot A: just before the first input (`beforeInput` hook; `scrollClick`: before the scroll starts, a mid-scroll snapshot would jank). Snapshot B: scenario end. Each take resets counters, so B = interaction window only. `load`: single snapshot at end.
- Prefetch waste (Rivet only), JS responses finished before the first pointerdown/keydown (same set as `jsBytesBeforeInteraction`):
  - strategy: URL in `data-preload` → `eager` / `idle` / `visible`; plan runtime URL → `runtime`; else the strategy of its importer (CDP request initiator; static deps go to whichever chunk requested them first); else `intent`;
  - "used" = some function other than the module top level ran (count > 0) by scenario end. Evaluation (warm at idle) alone is not use; helpers called by top-level code at evaluation are (lower bound on waste);
  - `prefetchBytes.<strategy>` = transfer bytes (`encodedDataLength`); `wastedBytes.<strategy>` = bytes of unused chunks;
  - `wastedForInteractionBytes.<strategy>` = bytes of chunks with no non-top-level function run after the first input (stricter: boot / client-effect use before input does not count); absent for `load`;
  - per-chunk detail in results JSON `runs[].prefetch`.
- First input synchronous (Rivet only; click scenarios: first trusted `click`, `filter`: first trusted `input`):
  - window capture listener (before any framework listener) starts a MutationObserver; window bubble listener (fallback `setTimeout 0`) ends the dispatch;
  - `firstInputSync` = the scenario's DOM update was already there at dispatch end (`count` / `detail` mark; `filter`: `#rows` subtree mutated) → handler ran in the input task, no fetch/await before dispatch;
  - `jsRequestsDuringFirstInput` = JS resource requests started between first pointerdown/keydown and that dispatch end;
  - summary cell: share of repeats + per-repeat `y`/`n`; raw `runs[].firstInput`.

## Versioned comparison lanes

- `solid`: Solid 2 preview with `@solidjs/compiler` / `@solidjs/vite-plugin`.
- `solid-stable`: Solid 1.9.15 with babel-preset-solid 1.9.15, vite-plugin-solid 2.11.14 and Vite 7.3.6.
  Uses Solid 1's `createResource`, `Suspense`, `onMount`/`onCleanup`, and `renderToStringAsync` for
  the same serialized data and hydration workload. Explicit aliases resolve all `solid-js`,
  `solid-js/web`, and `solid-js/store` imports, including runtime-internal imports, to Solid 1.
- `qwik`: Qwik 2 preview (`@qwik.dev/core`).
- `qwik-stable`: Qwik 1.20.1 (`@builder.io/qwik`) and its own optimizer with Vite 7.3.6.
  Uses the supported two-argument `useOnWindow` hook; Qwik 1 has no per-hook passive option.
  Scroll events are non-cancelable, and the handler and measured DOM behavior are identical.
- Stable versions were checked against the npm registry on 2026-10-04. Their toolchain is isolated
  in `apps/bench-stable`; existing preview dependencies remain installed and measured separately.
- Each lane writes `build-manifest.json` with its exact resolved package versions, production
  configuration, source hashes, and emitted artifact hashes. Results embed the selected manifests.
  The runner rejects stale manifests and keeps all lanes in every selected scenario/condition.

Run `node apps/resume-bench/run.ts --build --verify` to check the same fixture contract in all five
lanes, or select lanes explicitly with `--lanes rivet,qwik,qwik-stable,solid,solid-stable`.
