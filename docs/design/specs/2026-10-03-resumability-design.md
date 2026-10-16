# Rivet resumability design

Date: 2026-10-03. Status: approved design; implementation via four sub-project plans. Sub-project 1 (Core) implemented — [docs/guides/resumability.md](../../guides/resumability.md).

## Goal

- SSR pages become interactive without re-executing any component in the browser (Qwik-style resume).
- Only touched code loads, ahead of need when possible, without blocking the main thread.
- Replace the playground's `/csr` demo with resumed SSR pages.

## Decisions (user-approved)

- Model: full resume via serialized binding graph; no component re-execution. Creating *new* DOM for a dynamic region on the client is creation, not resumption, and is allowed.
- Captures: strict serializable set + context-token refs. Anything else: compile diagnostic when provable, else server render error naming the capture.
- Chunking: configurable per app — `component` | `group` | `route`. Symbols are the addressable unit; strategy changes grouping/manifest only.
- `ChunkGroup` = code-grouping boundary, not a hydration model (renamed from `Island` 2026-10-12; "island" now means a framework island, see `2026-10-11-framework-bridges-design.md`).
- Preloading: per-chunk strategies ordered by impact; prefetch (off-main-thread) separated from evaluation (main thread).
- M1 scope: events, signals, text/attribute bindings, `model:`, dynamic children, `For`, router, `lazyComponent`, `Async`, client-only code (`clientEffect`, `clientEvent`, `window:` / `document:` JSX events, `ref`, `clientOnly` mounting).
- Success gates:
  - zero-cost static SSR (ssr-bench HTML byte-identical; Razor lead unchanged);
  - playground fully resumable, Playwright-verified;
  - before first interaction only the loader executes, ≤2 KB brotli;
  - real-Chrome interaction benchmark vs Qwik and Solid recorded.

## Units

| Unit | File | Responsibility | Depends on |
|---|---|---|---|
| Compiler extraction | `libs/compiler/resume.mjs` (called from `index.mjs`) | Hoist handlers / reactive expressions to symbols with explicit captures; emit server recorder calls; emit DOM templates for dynamic regions; capture diagnostics | TS checker |
| Resume format | `libs/runtime/resume-format.mjs` | Encode/decode object table: primitives, plain objects/arrays, Date/Map/Set, signals, computeds, symbol refs, context refs, cycles/sharing | — |
| Server recorder | `libs/runtime/server-resume.mjs` | Element/range IDs, binding read tracking, object interning, region tree, per-region state scripts, preload hints | reactivity, server renderer, format |
| Loader | `libs/runtime/resume-loader.mjs` (inlined) | Delegated listeners, symbol→chunk resolution, sync-run-if-loaded, default replay, preload scheduler, `when` triggers | manifest |
| Client resume runtime | `libs/runtime/dom-resume.mjs` | Revive signals + binding stubs, region owners, patch text/attr/children, `For` adoption, router/lazy/Async continuation, client effects/events, `clientOnly` mounts | reactivity, DOM runtime, format |
| Bundler plugin | `libs/compiler/vite.mjs` | Chunk strategy, symbol manifest with impact scores, artifact sizes | Vite |
| Benchmark | `apps/resume-bench` | Identical fixture in Rivet / Qwik / Solid, real Chrome, CDP traces | Playwright |

## Compile

- Each event handler, reactive child/attribute expression, `model:` binding, computed fn and `For` row callback becomes a module-level symbol `Component$n` (n = source order; identical in server and DOM builds).
- Symbol shape: `(captures...) => fn`. Captures = free variables of the closure that are not module-scope bindings (module imports/top-level consts stay references).
- Symbol id: `<project-relative path>#<name>`.
- Server target emits:
  - `__rivetOn(type, sym, [captures])` attribute slot;
  - `__rivetBind(sym, [captures])` child/attribute slot;
  - `__rivetModel(kind, sym, [captures])`.
- DOM target emits the same symbols plus templates for components reachable from dynamic regions.
- `clientEffect` / `clientEvent` callbacks and `ref` callbacks are hoisted the same way.
- A local assigned only inside a `ref` callback (`let el; ref={(x) => (el = x)}`) is ref-bound: revived from its element, never serialized.
- `window:onX={fn}` / `document:onX={fn}` compile to `clientEvent(window|document, "x", fn)`.
- Diagnostics:
  - capture statically bound to a class instance (`new`), DOM node, non-symbol function, or `this`;
  - browser globals (`window`, `document`, `navigator`, `localStorage`, …) used in a component body outside handlers / effects / client events, when provable;
  - `clientEvent` target other than `window`, `document`, a ref-bound element or `"media:(query)"`;
  - warning: `preventDefault` inside a handler for a passive type.
- Components with no resumable slots compile exactly as today.

## Server render

- Recorder activates only when a page reaches a resumable slot; otherwise no IDs, state, loader or hints are emitted.
- Element with events/attribute bindings gets `data-r="<id>"`.
- Text binding: `<!--r<id>-->value<!--/r<id>-->`.
- Child binding / `For` row / route region: range markers `<!--r<id>[-->` … `<!--]r<id>-->`.
- Binding evaluation runs the symbol under a tracking observer; the signals read become subscriptions.
- Object table:
  - captures interned by identity (sharing + cycles preserved);
  - signal `{s: value}`;
  - computed `{c: sym, a: captures}`;
  - context value `{x: tokenId}` — tokens declare `createContext(default, { id })`, and the recorder maps provided values to token ids;
  - router `{rt: location, data}`.
- `clientEffect` / `clientEvent` bodies never run on the server; the recorder stores `{effect | event: sym, a: captures, when, target, refs}` under the region.
- `clientOnly`: fallback rendered inside range markers; recorder stores `{mount: importerSym, when}` (default `visible`).
- Regions: tree of region ids; each region's entries go in its own `<script type="rivet/state" data-region="<id>">`.
- Page tail:
  - root state script with build hash and `data-events` list;
  - inline loader;
  - `modulepreload` hints only for `eager` chunks.

## Loader and client runtime

- Loader budget (≤2 KB brotli) includes the scheduler; strategy code beyond `intent`/`interaction` must fit or load at idle.
- Before interaction: one capture-phase listener per type in `data-events`. Passive except `click`, `submit`, `keydown`. No `scroll` / `wheel` / `touchmove` listeners unless the page binds them.
- On event:
  - walk `composedPath()` to the nearest `data-r` element with a handler for the type;
  - parse that element's region state once (lazy, per region).
- Chunk already evaluated: run the handler synchronously inside `batch` (so `preventDefault` works).
- Not evaluated:
  - `a[href]` click / `form` submit: cancel the default, load, run, then replay the navigation/submit unless the handler prevented it;
  - other events: load, then run with the original event object.
- Revive:
  - signals become real signals;
  - subscribed bindings become stubs that cost nothing until notified; a notified stub loads its symbol and runs as an effect under its region owner, after which normal tracking applies;
  - context refs come from `resume({ contexts: [[token, value]] })` in the client entry.
- Patching: text between markers, attributes via `bindAttribute` semantics, children via DOM templates. Disposing a region disposes its revived bindings.
- `For`: server serializes keys + row items; the client adopts existing row ranges by key, then reconciles normally; new rows use DOM templates.
- Router: revived on first navigation from serialized location + loader data.
- Client-only code: see the section below.
- `lazyComponent` / `Async`: resolved content resumes as regions; pending ones continue from serialized pending state.
- Work slicing:
  - reviving >32 bindings in one task yields via `scheduler.yield()` (fallback `MessageChannel`);
  - the binding of the current interaction runs first.

## Client-only code

### `clientEffect(fn, { when })`

```jsx
function Chart({ points }) {
  let canvas;
  clientEffect(() => {
    const ctx = canvas.getContext("2d");
    draw(ctx, points());          // signal read → reruns on change
    return () => ctx.reset();     // cleanup on region dispose
  }, { when: "visible" });
  return <canvas ref={(el) => (canvas = el)} width={600} height={300} />;
}
```

- Client: at the trigger, resolve refs to elements, then run as a normal reactive effect under the region owner (signal changes rerun it; region disposal runs cleanup).
- Default `when`: `visible` when the effect uses a ref, else `idle`.
- Same-region effects run in source order, parent before child.
- Third-party scripts (gtag): `clientEffect(async () => { await import("./analytics.js"); gtag(…); }, { when: "idle" })`; the module gets its own chunk, never prefetched before idle. Page views rerun via the router location signal. `<script>` in JSX stays disallowed.

### `clientEvent(target, type, handler, { when, passive, capture, once, preload })`

| Target | Resolution | Recorded |
|---|---|---|
| `window` / `document` | unshadowed globals, recognized by the compiler | `{t: "w"}` / `{t: "d"}` |
| ref-bound element / ref getter | `data-r` id on resume | `{t: "r", id}` |
| `"media:(query)"` | `matchMedia(query)` `change` event | `{t: "m", query}` |

- `when` = when the listener attaches; the handler chunk still loads on the first event:
  - `load` (default; the loader attaches right after startup, listener only, no app code);
  - `visible` (element targets);
  - `idle`, `interaction`, `media:<query>`.
- `passive` defaults to true for `scroll`, `wheel`, `touch*`, `pointermove`, `resize`. `passive: false` raises the chunk to `eager` prefetch so `preventDefault` can run synchronously.
- `preload` default: `idle` for window/document targets, `visible` for element targets.
- Owned by the region (removed on dispose); `once` removes it after the first run; handler runs in `batch`.
- Inside `clientEffect` it just calls `addEventListener`, scoped to the effect owner.

### `when` triggers (shared by `clientEffect`, `clientEvent`, `clientOnly`)

| `when` | Fires | Prefetch |
|---|---|---|
| `load` | first idle slice after load | `eager` |
| `visible` | element enters viewport | 1 viewport ahead |
| `idle` | `requestIdleCallback` | idle |
| `interaction` | first user input anywhere | intent |
| `media:<query>` | query matches | when it matches |

### `clientOnly(importer, select, { fallback, when })`

- At the trigger, import and mount the component into the range through the DOM target (creation, allowed).
- Signal props stay shared with the resumed page.

### Errors

- Effect / client event errors → `rivet:resume-error` with component + symbol id; other regions unaffected.

## Chunk strategy (per app)

```js
rivet({ resume: { chunks: "component" | "group" | "route", preload: { default: "auto", rules: [{ match, strategy }] } } })
```

- `component`: one chunk per component (its symbols + templates for its dynamic children).
- `group`: one chunk per `<ChunkGroup>` subtree (`ChunkGroup` from `@rivetjs/runtime/{server,dom}`; renders children unchanged, marks a grouping boundary); every component reachable inside joins it.
- `route`: one chunk per route module graph; `defineRoute` / `lazyComponent` import edges split.
- Manifest maps each symbol to a chunk URL, a static impact score, the chunk size, and a reserved `field` slot for later telemetry.

## Preload scheduler

- Prefetch = inject `<link rel=modulepreload fetchpriority=low>`; network + streaming compile off the main thread.
- Evaluate = `import()`, only on intent or in ≤5 ms idle slices; never during active scroll (scroll within the last 150 ms) or input.

| Strategy | Prefetch | Evaluate | Auto default for |
|---|---|---|---|
| `eager` | after first paint | first idle slice | author-marked critical |
| `visible` | element within 1 viewport (IntersectionObserver) | intent | `For` rows, below-fold content |
| `intent` | `pointerenter` (60 ms dwell), `focusin`, `touchstart` | `pointerdown` / `keydown` | click/submit handlers |
| `idle` | `requestIdleCallback` after load | on use | rare handlers, router chunks |
| `interaction` | the event | the event | tiny/rare handlers |

- Static impact score (build):
  - event kind weight: click/submit 3, input 2, hover 1;
  - × number of bound elements;
  - + 2 when on a navigation path;
  - smaller chunk first on ties.
- Runtime score: in viewport ×4, near ×2; intent signals → immediate; a chunk used on the page boosts siblings in the same chunk group / route.
- Budgets:
  - at most 2 concurrent prefetches; intent jumps the queue;
  - `saveData` or `effectiveType` ≤ `2g` → only `intent` / `interaction`;
  - each chunk fetched once; the strongest strategy wins.
- Overrides, precedence element > component > app rule > auto:
  - element: `preload="eager|visible|intent|idle|interaction"`;
  - component: `export const preload = "…"` or a `ChunkGroup` prop;
  - app: `rules`.

## Errors

- Unserializable capture: compile diagnostic when provable; else server render error naming component, capture and value type.
- Missing client context: resume error naming the token id at first use.
- Chunk load failure: retry once, then dispatch `rivet:resume-error` on `document`; the default listener reloads the page.
- Build hash mismatch (stale HTML vs new deploy): reload.

## Testing

- Format round-trip: cycles, sharing, Map/Set/Date, signals, computeds, context refs, refusal cases.
- Compiler:
  - free-variable sets;
  - module refs vs captures;
  - server/DOM symbol-name agreement;
  - diagnostics.
- Differential: CSR `mount` vs SSR+resume give identical DOM after the same interaction scripts (playground scenarios + fuzzed signal-write sequences).
- Playwright, Chrome channel:
  - instrumented counters prove no component function runs in the browser;
  - only the loader executes before interaction;
  - sync handler when prefetched;
  - default replay for links/forms;
  - offline chunk → reload fallback;
  - scheduler respects Save-Data and scroll pause;
  - `clientEffect` triggers (`visible` / `idle` / `media`), cleanup on region dispose, signal reruns;
  - `clientEvent` targets, passive defaults, `once`, attach timing; JSX `window:` / `document:` equivalence;
  - `clientOnly` mounts at its trigger with shared signal props.
- Zero-cost: ssr-bench HTML byte-identical; Razor comparison re-run.

## Real-Chrome benchmark (`apps/resume-bench`)

- Fixture, identical per framework (Rivet resume, Qwik, Solid SSR + hydration):
  - counter;
  - 1,000-row filterable keyed list;
  - toggle region;
  - client navigation to a lazy detail route;
  - canvas `clientEffect` (visible) and gtag-style idle effect;
  - `window` scroll `clientEvent` (sticky header).
- Conditions: cold cache; unthrottled and CDP Slow 4G + 4× CPU. Scenario "scroll during first interaction": scripted continuous scroll while the first click triggers a chunk fetch.
- Metrics:
  - JS bytes transferred/executed before interaction;
  - TBT and longest task;
  - Long Animation Frames (count, max);
  - click → DOM-update latency (cold, prefetched);
  - INP;
  - max rAF frame gap and dropped frames during scroll;
  - main-thread blocked time during fetch.
- Per Rivet preload strategy: wasted prefetch bytes, share of first interactions served synchronously.
- Client-only: effect main-thread time; idle effects never inside a LoAF while scrolling.
- 10 repeats per lane, randomized order, medians + ranges, raw traces archived.

## Sub-projects (each: own plan → implementation)

1. Core:
   - format;
   - compiler extraction for events / text / attr / `model:`;
   - server recorder;
   - loader with scheduler core (`intent`, `interaction`) + default replay;
   - client runtime for signals and bindings;
   - `clientEffect`, `clientEvent`, `ref`, `window:` / `document:` JSX events;
   - chunk strategy `component`;
   - playground counter + filter input resumed.
2. Dynamic regions:
   - child bindings + `For` adoption;
   - DOM templates in chunks;
   - `clientOnly` mounting;
   - `visible` / `idle` / `eager` + impact scoring;
   - `group` strategy.
3. Navigation:
   - router resume;
   - `lazyComponent` / `Async` continuation;
   - `route` strategy + navigation weighting;
   - navigation-aware page-view effects.
4. Proof:
   - playground `/csr` replaced;
   - `apps/resume-bench` vs Qwik / Solid;
   - artifact sizes;
   - gates report.

## Non-goals (M1)

- Telemetry-learned impact scores (manifest slot reserved).
- Service-worker prefetch.
- Partial / islands hydration fallback.
- Serializing arbitrary class instances.
