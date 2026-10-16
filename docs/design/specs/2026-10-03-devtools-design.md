# Rivet DevTools (design)

Status: approved 2026-10-03 with the recommended answer to every open question (see Resolved questions). P0 + P1: [implementation plan](../plans/2026-10-03-devtools.md). Builds on [dev builds](2026-10-03-dev-builds-design.md), [resumability](2026-10-03-resumability-design.md), [async streaming](2026-10-03-async-streaming-design.md), [router](2026-10-03-router-design.md), hot replacement (`libs/runtime/hot.ts`, `libs/compiler/hot.ts`).

## Goal
- Inspect a running Rivet app in development:
  - component tree: owners + DOM ranges;
  - signal / computed / effect inspector: live values, dependency graph;
  - update highlighting: which DOM bindings re-ran, and in which component;
  - resume timeline: which chunks loaded, why (interaction / intent / eager / idle / visible / sibling group / lazy), resume state size;
  - router state: current route, loaders, data, timings;
  - async boundaries: pending / resolved / error / streamed / continued;
  - HMR events: what hot-updated, state kept or reset, and why;
  - errors with dev hints (`DEV.hint` keys) and source locations.
- Zero production cost: production runtime bundles byte-identical (Rolldown and esbuild), ssr-bench HTML byte-identical, inline loader string unchanged.
- One agent + protocol, several hosts: Vite-served panel first, browser extension as a later thin bridge.

## Non-goals
- Inspecting production builds (no hooks exist there by design). Reproduce with a development build instead.
- Time-travel / state snapshots and replay.
- Server-side reactive graph inspection (SSR owners are short-lived). Server-side data limited to request timings + resume encoding info.
- Editing component props or computeds. Writes only to signals with JSON values.
- Performance profiler / flamegraphs in v1 (phase 4).
- Safari extension.

## Architecture

### Components
- **Hook** (`globalThis[Symbol.for("rivet.devtools")]`): tiny global event sink, created by whichever dev module runs first (reactivity façade, runtime `dev/on.ts`, dev loader). Global object, not a module import: reactivity cannot import runtime, and the inline loader cannot import anything.
  - Shape: `{ v: 1, level: 0 | 1 | 2, q: Event[] /* ring, 5000 */, emit(type, data), on: ((e) => void) | null, stacks: boolean }`.
  - `level` 0: buffer cheap, low-rate events only (resume, route, hmr, error); 1 (browser default): + structure (owner/component create/dispose, signal create); 2 (panel recording): + signal writes, node runs, DOM updates, timings.
- **Agent** (`@rivetjs/devtools/agent`, page realm): attaches to the hook, drains the buffer, keeps id maps (`WeakMap<object, number>`), walks owners via `_debug`, serializes value previews, draws highlight overlays (one shadow-root host, `pointer-events: none`), answers UI requests. Never imports app code; never invokes getters on user objects.
- **UI** (`@rivetjs/devtools/ui`): prebuilt Rivet app (dogfood), shipped as static assets inside the package, runs in its own realm (iframe or separate window), talks only protocol. Its own reactivity never reaches the page hook (separate `globalThis`).
- **Host**: transport + where the UI lives.
- **Server side**: router dev timings (`Server-Timing`), dev encoder sidecar (resume state provenance), Vite ws for compile/HMR errors.

### Delivery options

| | Browser extension (Chrome/Firefox) | In-page overlay | Vite plugin panel (iframe dock + pop-out) |
|---|---|---|---|
| Install | store install, per browser | none | none (`rivet()` in serve) |
| Isolation from app | full (devtools page) | poor: shares document, CSS, main thread | good: own realm/document; shares main thread only when docked |
| Version skew agent↔UI | real (store release vs app deps) | none | none (same package) |
| Server access (SSR timings, compile errors, open-in-editor) | via page only | via page | direct (Vite ws, `/__open-in-editor`) |
| Works without Vite (`node --conditions=development` dev builds) | yes | if injected | needs router node adapter to serve assets (phase 2) |
| Native integration (`$0`, Elements reveal, `inspect()`) | yes | no | no |
| Mobile / any browser | no | yes | yes |
| Playwright-testable | awkward (persistent context) | yes | yes |
| Strict CSP / Trusted Types pages | unaffected | must carry nonce, no `innerHTML` | agent script gets nonce (devScripts path); UI document has own CSP |
| Effort | high (MV3, 2 APIs, relay, store) | low | medium |

- Recommendation: **Vite plugin panel**.
  - Agent injected as a dev script (router `devScripts`, else `transformIndexHtml`); UI served at `/__rivet/devtools/`.
  - Docked: iframe in a shadow-root drawer (toggle `Alt+Shift+R` / corner button). Pop-out: same URL in a window, linked by `BroadcastChannel` (keeps page layout and main-thread perturbation minimal during measurements).
  - Extension in phase 4 as a bridge only: content script relays `window.postMessage` ↔ devtools page that loads the same UI bundle. No separate agent.
- Rejected: overlay-first (no isolation; UI's own signals and CSS leak into the inspected page); extension-first (install friction, skew, no server access, slowest to iterate).

### Data flow
- Instrumented runtime → `hook.emit` → ring buffer (until agent attaches) → agent → batched per animation frame → transport → UI store.
- UI requests → agent → reads structure lazily (`_debug` walks) → response.
- Server (Vite middleware / router `#dev`) → `Server-Timing` header on document and data responses → agent reads `PerformanceNavigationTiming.serverTiming` / `PerformanceResourceTiming.serverTiming` (same-origin, no custom transport).

### Modes
- `vite serve` (dev pages, CSR over SSR HTML, hot replacement): components, signals, highlighting, async, router, HMR, errors. No resume (dev pages never resume: `libs/compiler/vite.ts`).
- Development build (`NODE_ENV=development vite build` + `node --conditions=development` server): resume timeline, state size, streamed segments, resumed regions. Router node adapter (under `#dev`) serves agent + UI and injects the agent script.

## Instrumentation hooks
Minimal set. Each names file, mechanism, payload.

### Reactivity (`libs/reactivity`)
- **R0 `_debug(x)`** — new export in `index.ts`, read-only, tree-shaken when unimported (pattern: `_inspect`, `_trackReads`, `_ranges`).
  - Input: signal getter, computed getter, `Owner` handle.
  - Output (frozen view): `{ kind: "owner" | "computed" | "effect" | "signal", value?, state: "clean" | "check" | "dirty", failed, disposed, parent, children(): Owner[], sources(): View[], observers(): View[], getter? }`.
  - Keeps field-name coupling (`first/next/sources/observers/...`) inside `index.ts`; refactors there update it.
- **R1 façade `libs/reactivity/dev.ts`** — selected by package `exports` condition (`".": { "types": "./index.ts", "development": "./dev.ts", "default": "./index.ts" }`). `export * from "./index.ts"`, overrides creators; returns the real primitives (identity, `_inspect`, `_trackReads`, resume encoding unchanged):
  - `signal(v, o)`: real signal; meta `{ owner: getOwner(), stack? }`; replace `get.set` (and thereby `update`, which calls `get.set`) with a wrapper → `sig.write { id, prev, next, observers }` at level 2. Emits `sig.create` at level ≥ 1.
  - `computed(fn, o)` / `effect(fn)`: real primitive over a wrapped `fn` → on run: node = `getOwner()` (the node itself during its run), `node.run { id, ms, changed, error }` at level 2; first run registers the node (`node.create`).
  - `createRoot`, `provide`: tag the new owner (`owner.create`, context token id for `provide`).
  - `batch`: `batch.start/end` (groups writes and runs into one flush in the UI).
  - Signals are not owner children: meta keeps `owner → signals` so the tree can show a component's signals.
  - No extra observers are ever added: live values come from write/run events, so laziness and flush order stay identical.
- Hot-reactivity (`libs/runtime/hot-reactivity.ts`) re-exports `@rivetjs/reactivity` → composes with the façade unchanged.

### DOM runtime (`libs/runtime`)
- **D1 façade `libs/runtime/dev/dom.ts`** — `exports["./dom"]` gains `"development": "./dev/dom.ts"`. Compiled DOM modules import `@rivetjs/runtime/dom` (compiler `compile.rs`), so all compiled output is covered with no compiler change. Explicit exports shadow `export * from "../dom.ts"`:
  - `component(fn, props)`: wraps `fn` → tags `getOwner()` (the component root `wrap` creates) with `{ name: hot id (`file#Export`) ?? fn.name, range }`; range from `_ranges.get(result)`. Emits `comp.mount`; `onCleanup` → `comp.unmount`.
  - `mount`: registers tree roots (container, root owner).
  - `bindChild`, `bindAttribute`, `bindRCData`, `bindModel`: wrap `read` → after each re-run `dom.update { node, kind, name, comp }` (level 2). First run is creation, not an update.
  - `bindEvent`, `clientEvent`: wrap handler → `dom.event { type, node, ms }`.
  - `For`: wrap row callback → row create/dispose counts per flush.
  - `Async`, `lazyComponent`, `clientOnly`: wrap `fallback` / `children` / `error` callbacks (never the `load` thenable: `Async` observes `then` exactly once) → `async.state { id, state: "loading" | "pending" | "resolved" | "error" | "replaced", ms }`; `load` call = start.
- **D2 `dom-resume.ts`** (already imports `#dev`): `DEV && DEV.emit(...)` at cold sites: `start` (state counts), binding activation `{ node, symbol, cause: "signal" ref | trigger }`, region re-create, `dispatch { type, id, symbol, waitedMs, replayed }`, `patch` (streamed segment), missing symbol (`skew`).
  - Resumed bindings use relative `./dom.ts` imports, bypassing D1: per-update highlighting on resumed pages needs Q11.
- **D3 dev loader variant** — `build-loader.ts` emits `LOADER`/`STREAM` (as now, `define: { __RIVET_DEV__: "false" }`, dead code removed) plus `LOADER_DEV`/`STREAM_DEV` (`"true"`) into `resume-loader.dev.ts`, imported only by `dev/on.ts`.
  - `resume-loader.ts`/`resume-stream.ts` gain `if (__RIVET_DEV__) hook(...)` statements; prod string byte-identical (gate below).
  - `server-resume.ts` writes `DEV ? DEV.loader : LOADER` (cold: once per page).
  - Loader events (pushed to the global hook ring, the loader's only allowed global): `parse { bytes, handlers, bindings, chunks }`, `schedule { url, strategy: e|i|v, ids }`, `prefetch { url, reason: "hover" | "focus" | "touch" | "pointerdown" | "keydown" | "eager" | "idle" | "visible" | "group" | "lazy", urgent }`, `preloaded { url, ok }`, `evaluate { url, reason: "interaction" | "warm" }`, `boot { ms }`, `dispatch { type, id, waitedMs, replay }`, `segment { A, status }`, `error`.
- **D4 dev encoder sidecar** (`server-resume.ts`, `#dev`): `<script type="rivet/dev">` after the state script: per-section byte sizes (`t`, `e`, `b`, `s`, `c`, `k`, `fx`, `ce`, `a`), per table ref → `{ symbol, capture path }` (reuses `DEV.at` path building), preload provenance per chunk (`directive | component | rule | auto`).
  - Manifest provenance: `rivet()` adds `preloadSource` to `.vite/rivet-resume.json` in development builds only.
- **D5 `hot.ts`** (dev-only file, free): `hot.register { id }`, `hot.update { id, instances, restored, reset: null | "refresh-reset" | "shape" | "kind" }`, `hot.invalidate { id }`; export `hotId(wrapper)` for D1 names.
- **D6 `dev/on.ts`**: `DEV.emit(type, data)` (forwards to hook); `DEV.hint` also emits `error.hint { key, message }`.

### Router (`libs/router`)
- **RT1** new `#dev` import map (same `on.ts`/`off.ts` pattern as runtime).
  - `server/handler.ts`: `DEV ? DEV.time(...)` around match, guards, actions, each layout/page loader, head, render → `Server-Timing: match;dur=…, guard;dur=…, load-0;desc="routes/_layout";dur=…, render;dur=…` + `x-rivet-route: <id>` (document and data responses).
  - `client/index.ts`: `route.nav { url, id }`, `route.data { url, ms, bytes, prefetched, redirect }`, `route.error`, `route.settle`.
  - `adapters/node.ts` under `#dev`: serve `/__rivet/devtools/*`, inject agent script (with nonce) — development builds only.
- `dom-router.ts` location signal: labelled `router.href` through D1/R1 meta; no new hook.

### Vite plugin (`libs/compiler/vite.ts`, serve only)
- **V1** inject agent (`@rivetjs/devtools/agent`) as a dev script; serve UI; ws channel `rivet:devtools` relays `vite:error`, compile diagnostics, SSR errors (`ssrFixStacktrace`ed); open-in-editor via Vite's `/__open-in-editor?file=path:line:col`.
- Agent listens to `import.meta.hot` events: `vite:beforeUpdate`, `vite:afterUpdate`, `vite:invalidate`, `vite:error`, full reload.
- Option `rivet({ devtools?: boolean })` (Q9).

## UI panels
- **Components**: tree of mount roots → component owners (name, file link) → nested owners (Provider token, Async, For rows collapsed).
  - Hover = outline range bounding box (union of node rects between range comments).
  - Picker = click page element → nearest component.
  - Side pane: signals created in it (value, edit), computeds/effects (run count, last ms), context provided, props preview (top-level keys, no getter invocation).
  - Resumed pages: server regions from state (`data-r` ids, region parents, symbol ids `file#Comp$n` → component names), marked "resumed, not executed".
- **Signals**: searchable list of signals / computeds / effects (owner, name/stack, value, writes, runs).
  - Dependency view: selected node, sources upward, observers downward, depth-limited; v1 indented lists, phase 4 DAG drawing.
  - "Why did this run": last flush's write → mark chain → this node.
- **Updates**: toggle "highlight updates" (flash rect per `dom.update`, color by frequency, merged per frame); counter per component; flush list (write → runs → DOM updates).
- **Resume** (development build): timeline lanes per chunk URL: scheduled (strategy, provenance) → prefetched (reason) → preloaded → evaluated → used (dispatch); interaction markers; boot.
  - Size card: state bytes (raw, gzip/brotli estimate via `CompressionStream`), per section, top 20 table entries by size with capture path.
  - Waste: prefetched-never-used chunks (same notion as resume-bench "prefetch waste").
  - Streamed segments: A id, status (inserted / dropped / continued), timing.
- **Router**: current URL, route id, params, layout chain, loader data previews per layout, Server-Timing breakdown (document + each data navigation), navigation history with timings, redirects/errors.
- **Async**: boundaries list (owner, state, duration, fallback shown?, error), streamed vs client-loaded vs continued.
- **HMR**: log of updates (`file#Export`, instances updated, state kept / reset + reason), invalidations (non-component export changed), full reloads, Vite errors.
- **Errors**: runtime errors (window `error`/`unhandledrejection`, `rivet:resume-error`), dev hints (key, cause+fix text, docs link), resume drift/skew, compile errors; source-mapped stacks; open in editor.

## Data protocol
- Transport:
  - docked: agent creates `MessageChannel`, transfers a port to the iframe on `load`;
  - pop-out: `BroadcastChannel("rivet-devtools:" + sessionId)`, `sessionId` from the agent (shown in the window title);
  - extension (phase 4): content script relays `window.postMessage({ source: "rivet-devtools", ... })`.
- Envelope: `{ v: 1, s: seq, t: type, ts: page performance.now(), d: payload }`; agent → UI sent as arrays once per animation frame, ≤ 500 events; overflow → `{ t: "dropped", d: n }`.
- Handshake: UI `hello { v }` → agent `welcome { v, mode: "serve" | "build", features, level }`; major-version mismatch → UI shows "reload page" (same package, should not happen).
- Ids: agent-allocated integers per object kind (`o` owner, `n` node, `g` signal, `d` DOM node, `c` chunk URL). UI never holds references; agent maps are weak.
- Values: preview `{ k: "u" | "n" | "s" | "b" | "big" | "o" | "a" | "map" | "set" | "date" | "fn" | "sig" | "dom" | "err" | "cyc" | "get" | "trunc", p: string, h?: handle, n?: size }`; depth 1, strings ≤ 120 chars; accessors shown as `get` (never invoked); `value.inspect { h, path }` expands lazily; handles in a capped map (LRU 1000).
- Requests (UI → agent): `level.set`, `tree.get { root? }`, `owner.get { id }`, `graph.get { id, dir: "up" | "down", depth }`, `value.inspect`, `signal.set { id, json }` (write through wrapped `.set`, event tagged `by: "devtools"`), `highlight { id | null }`, `pick.start/stop`, `editor.open { file, line, col }`, `resume.state` (sidecar + state stats), `buffer.get`.
- Events (agent → UI): `owner.create/dispose`, `comp.mount/unmount`, `sig.create/write`, `node.create/run`, `batch.start/end`, `dom.update/event`, `async.state`, `resume.*` (D2, D3), `route.*`, `hmr.*`, `error.*`.
- Connect: `snapshot { roots, buffered events }`, then incremental. Disconnect: agent drops to level 1, clears handles.

## Zero-cost strategy
- Only three mechanisms (all already in use or the same shape):
  1. `#dev` import condition (`development` → `dev/on.ts`, `default` → `dev/off.ts` with `DEV = false`): runtime (existing), router (new). Branches only at cold sites (per page / per request / per chunk / per interaction), never in render loops of `server.ts`/`dom.ts`.
  2. Conditional package `exports` → façade module (`development` → `dev.ts` / `dev/dom.ts`, `default` → unchanged file): reactivity `"."`, runtime `"./dom"`. Production resolution never sees the façade: no dead branches even in esbuild bundles.
  3. Dev-only code: `hot.ts`, Vite `serve` paths, `@rivetjs/devtools` (never imported by runtime production entries).
- Hot files (`reactivity/index.ts`, `dom.ts`, `server.ts`): no control-flow edits; only the additive `_debug` export (unreachable from production entries → tree-shaken).
- Inline loader: dev statements stripped by `define` + minify at generation; production `LOADER`/`STREAM` byte-identical to today.
- Who gets the dev build: `vite serve` (client + SSR), `NODE_ENV=development vite build`, `node --conditions=development`, esbuild with `conditions: ["development"]`. Identical to the dev-builds spec.
- Gates (CI):
  - Rolldown minified bundles of each public entry of runtime / reactivity / router: sha256 equal to `main`;
  - esbuild bundles used by ssr-bench and dom-bench lanes: sha256 equal (stronger than dev-builds spec: façades leave no residue);
  - ssr-bench lane HTML byte-identical; resume-bench production pages byte-identical;
  - `LOADER`, `STREAM` strings equal to committed values;
  - production bundles contain none of: `rivet.devtools`, `_debug`, `__RIVET_DEV__`, `Server-Timing`;
  - types: façades export exactly the surface of what they wrap (`typeof import("./index.ts")` assignability test).
- Dev-mode cost (not production, still budgeted): level 1 ≤ 10% on dom-bench run under `development`; level 2 recording ≤ 3×; server façade inert (level 0) unless `RIVET_DEVTOOLS_SERVER=1`.

## Phases / MVP
- **P0 foundations**: hook; `_debug`; reactivity + dom façades; D5 hot events; D6 `DEV.emit`; zero-cost gates; existing reactivity/runtime suites re-run under `--conditions=development`.
- **P1 MVP (`vite serve`)**: `@rivetjs/devtools` package (agent + prebuilt UI); V1 injection + docked iframe + pop-out; panels: Components (tree, hover, picker, owner side pane), Signals (values, edit, up/down dependency lists), Updates (highlight toggle, per-component counts), HMR, Errors (hints, Vite errors, open in editor).
- **P2 resume (development build)**: D2, D3, D4, manifest provenance; router node adapter dev serving; Resume panel (timeline, size, waste, segments); resumed-region tree.
- **P3 router + async**: RT1 (Server-Timing, client route events); Router panel; Async panel (client + streamed + continued).
- **P4**: DAG graph drawing; flush profiler (recordings, flamegraph); browser extension bridge; compiler dev labels for signal names (Q4).

## Testing
- Semantics: full reactivity, dom, dom-async, dom-router, resume suites run twice (default + `--conditions=development`, level 2 with an agent stub attached): identical results prove façades transparent.
- Façade parity: every export of `index.ts` / `dom.ts` is exported by its façade (reflection test; new runtime exports fail the test until listed as wrapped or passthrough).
- Event goldens: scripted fixtures (counter, nested components, For list, Async, Provider) → expected event sequences (ids normalized).
- `_debug`: tree/graph views match construction for nested owners, diverged dependency orders, disposed nodes.
- Loader: dev variant behavior in the existing resume browser tests (events for hover-intent, pointerdown evaluate, visible/idle schedules, sibling group); production string equality.
- Agent safety: values with throwing getters, proxies, cycles, huge arrays, DOM nodes → previews without invoking user code; agent never throws into the page (errors reported as `error.agent`).
- Zero-cost gates: listed above, run in CI (bundle hash comparison script, string-absence grep).
- E2E (Playwright, playground): open panel; tree shows App → layout → route component; click counter → `sig.write` + highlight flash + update count; hot-edit a component → `hot.update` with state kept; development build: first click → chunk loaded with reason `interaction` (and earlier `hover` prefetch), state size card matches `script[type="rivet/state"]` length.
- Isolation: UI iframe/window events never appear in the page stream; agent overlay excluded from picker and highlight.

## Resolved questions
All resolved 2026-10-03 with the recommended answer (listed first after →); options kept for context.
1. **Delivery host.** Options: Vite-served panel (iframe dock + pop-out) / browser extension / in-page overlay. → Vite panel now; extension later as a relay bridge over the same agent + UI.
    - **Resolved:** Vite panel (docked iframe + pop-out) now; extension later as a relay bridge.
2. **Façade mechanism for reactivity and dom.** Options: conditional package `exports` (`development`) / Vite `resolveId` redirect (like hot-reactivity) / `DEV ?` branches inside `index.ts` and `dom.ts`. → Conditional `exports`: also works under `node --conditions=development`, covers framework-internal imports, and leaves zero bytes in esbuild bundles (branches would leave dead code in the dom-bench/ssr-bench lanes and in hot loops).
    - **Resolved:** conditional package `exports` (`development` condition) selecting façade modules.
3. **Resume timeline while `vite serve` pages never resume.** Options: development build mode only (`NODE_ENV=development vite build` + `node --conditions=development`) / opt-in resume on the dev server (no hot replacement for resume modules) / both. → Development build mode in P2; dev-server resume opt-in later if users ask.
    - **Resolved:** development-build mode only, in P2 (outside P0/P1).
4. **Signal names and source locations.** Options: none (creation order + owner) / creation stack capture when the panel is open (`hook.stacks`) / compiler dev labels (`const count = signal(0)` → label `count`, `file:line`). → Stacks in P1 (on demand, source-mapped); compiler labels in P4 behind a dev compile option.
    - **Resolved:** creation stacks in P1 (on demand, source-mapped); compiler labels in P4.
5. **Server timing transport.** Options: `Server-Timing` header only / Vite ws rich traces (loader data sizes, errors) / embedded JSON in page. → `Server-Timing` in P3 (works for document and data requests, also visible in browser Network panel); ws traces later if needed.
    - **Resolved:** `Server-Timing`, in P3 (outside P0/P1).
6. **Instrumentation always on in dev, or opt-in.** Options: tag always (level 1: structure only, no per-update events) + full events while panel records / fully off until the panel enables it and reloads. → Tag always in the browser (tree available whenever the panel opens); server façade inert by default.
    - **Resolved:** structure always recorded in the browser in dev; server inert.
7. **UI technology.** Options: Rivet (dogfood, prebuilt, own realm) / plain DOM / Preact. → Rivet prebuilt in `@rivetjs/devtools`; exercises the framework and keeps one toolchain.
    - **Resolved:** prebuilt Rivet app inside `@rivetjs/devtools`, in its own realm.
8. **Editing state from the panel.** Options: none / signals with JSON values / arbitrary values via expression. → Signals with JSON values, written through the wrapped `.set` (normal flush, event tagged `by: devtools`); computeds and props read-only.
    - **Resolved:** JSON-valued signals only, written through `.set`.
9. **Enablement and packaging.** Options: new `libs/devtools` (`@rivetjs/devtools`), on by default in `vite serve` when installed, `rivet({ devtools: false })` opt-out / always explicit opt-in / built into `@rivetjs/compiler`. → New package, default on in serve when resolvable, opt-out flag; development builds opt-in (`RIVET_DEVTOOLS=1`) because they are often used for performance checks.
    - **Resolved:** new package `@rivetjs/devtools`; default on in `vite serve`, `rivet({ devtools: false })` opts out; development builds opt in with `RIVET_DEVTOOLS=1`; never in production.
10. **Production inspection.** Options: never / opt-in "profiling build" condition (like React profiling). → Never in v1 (non-goal); a profiling condition would be its own spec with its own gate.
    - **Resolved:** never in production.
11. **Update highlighting on resumed pages.** `dom-resume.ts` and `dom-router.ts` import `./dom.ts` relatively, bypassing the D1 façade. Options: switch them to package self-reference `@rivetjs/runtime/dom` (same file in production → identical bundles, verified by gate) / duplicate emits in `dom-resume.ts` per binding activation only / no highlighting on resumed pages. → Self-reference imports, guarded by the bundle-hash gate.
    - **Resolved:** self-reference imports `@rivetjs/runtime/dom` in `dom-resume.ts` / `dom-router.ts`, guarded by the bundle-hash gate (lands with P2, when resumed pages are inspected).
12. **Pre-attach buffer size.** Options: 1,000 / 5,000 ring / unbounded until attach. → 5,000-event ring at level ≤ 1; resume, route, hmr and error events never evicted by structure events (separate 500-slot ring).
    - **Resolved:** 5,000-event structure ring + 500-slot ring for rare events (resume, route, hmr, error).

## Implementation notes (P0 + P1)
Deviations from the text above, all conservative; user docs: [DevTools](../../guides/devtools.md).
- Hook created by the page agent only; façades and `DEV.emit` use an existing hook. SSR, node runs with `--conditions=development`, opted-out pages and development builds stay inert.
- `_debug` lives in `@rivetjs/reactivity/debug` (`debug.ts`), not `index.ts`: keeps the `@rivetjs/reactivity` / `hot-reactivity` entry bundles byte-identical.
- No `hotId` export (would change the `@rivetjs/runtime/hot` bundle); `hot.register { id, wrapper, impl }` names wrappers instead.
- `node.create` emitted at level 2 only; level 1 keeps `sig.create`, `comp.*`, `root.*`, hot and rare events.
- `bindEvent` / `For` / `Async` timing wrappers: P3. No `bindModel` highlight.
- `For`, `ChunkGroup`, `lazyComponent` and `clientOnly` wrappers hidden from the tree (`comp.hide`); lazy/client-only report the loaded component.
- Tree is the owner tree: route pages appear beside their layout (created by the router, passed as `children`).
- Previews read plain properties only (getters listed, not invoked); proxies may still run their traps (errors contained).
- `RIVET_DEVTOOLS=1` development-build opt-in lands with P2 (development builds are P2); P1 is `vite serve` only.
- Vite injects `@vite/client` ahead of `transformIndexHtml` head-prepend tags, so plain Vite pages load the agent second (still before app code); router dev pages list it first.
- UI built to `libs/devtools/dist/ui` (gitignored), `nx run devtools:build`; `devtools:test` depends on it.
- E2E runs on a temporary copy of the router fixture (the router suite edits its own copy concurrently).

## Implementation notes (P1b: value tree, signal names)
[Plan](../plans/2026-10-03-devtools-p1b.md). Deviations / additions:
- Signal names pulled forward from P4 (Q4), as a JS dev transform, not a compiler option: `nameSignals` (`libs/devtools/names.ts`, exported by `@rivetjs/devtools/server`) runs in `rivet()`'s transform on `vite serve` client modules when DevTools is on. Wraps `signal` / `computed` calls imported from `@rivetjs/*` (named, aliased or namespace imports) whose result is assigned to a binding, object property, class field (`#x` → `x`) or assignment target: `__rivetName(signal(0), "count")`; hoisted helper appended → hook event `name { value, name }`. Rust compiler, `compile()`, builds untouched (gates).
  - Same-line edits; the compiler map's generated columns shifted (VLQ, first field only), lines unchanged: `hotModule` (line-based) and stack locations keep working.
  - `.ts` / `.js` modules (not compiled by `rivet()`) unnamed; no inference through wrappers (`useCounter()`).
- Names keyed by graph ref (signal getter / computed node) with a creation sequence; scope = nearest visible component (plain / hidden owners below it share its scope); repeats numbered per scope in creation order (`count`, `count#2`), computed per request. Unnamed: `signal #id`. `displayName()` in `protocol.ts` is the only formatter (`Scope › name`).
- Protocol: `value.inspect { h, offset?, ancestors? }` → `{ entries, total }` (100 per page) instead of `{ h, path }`: the panel sends ancestor handles, the agent marks children among them `[circular]` (lower case). `value.text { h }` (truncated strings carry a handle; ≤ 64 KiB). `signal.setPath { id, path, json }`: JSON-safe signals, existing leaf only, fresh copy through `.set`. `Entry.proto` marks prototype accessors.
- Class instances: own keys, then accessors along the prototype chain (below `Object.prototype`, deduplicated, never invoked); methods omitted. DOM nodes, Date, RegExp, functions (`class X` vs `ƒ x()`), ArrayBuffer / DataView: one-line previews, not expandable. Typed arrays expand like arrays (length via `%TypedArray%.prototype`). Empty containers get no handle.
- UI: `ValueTree` reads the value in its own child function (component props are evaluated untracked), so writes re-render it; expanded paths survive re-renders (re-fetched with the new handle); depth cap 32.
