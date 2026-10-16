# Resumability Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** implemented 2026-10-03 — see [docs/guides/resumability.md](../../guides/resumability.md) for the shipped surface, measurements and limits.

**Goal:** SSR pages resume event handlers, text/attribute bindings, `model:`, `ref`, `clientEffect`, `clientEvent` and `window:`/`document:` JSX events without re-running any component in the browser.

**Architecture:** Compiler (resume mode) hoists handler/binding/effect closures into module-level symbols `(captures) => fn` and emits recorder ABI calls on the server target. Server recorder (AsyncLocalStorage-scoped) tracks signal reads per binding, interns captures into an object table and appends one state script + inline loader. Loader delegates events and loads the client runtime + symbol chunks (intent prefetch); runtime decodes captures, revives signals and lazily activates subscribed bindings.

**Tech Stack:** Node 24 ESM `.mjs`, TypeScript 5.9 compiler API, `node:test`, Playwright Chromium, Vite 8.

**Spec:** [docs/design/specs/2026-10-03-resumability-design.md](../specs/2026-10-03-resumability-design.md) — sub-project 1 (Core).

## Global Constraints

- Zero-cost static SSR: resume mode is opt-in (`compile(..., { resume })`); without it, output byte-identical to today; ssr-bench HTML byte-identical.
- No resumable slot reached at render → no `data-r`, markers, state or loader.
- Loader ≤2 KB brotli (inline, incl. scheduler core `intent` / `interaction`).
- No component function runs in the browser on a resumed page.
- Captures: strict serializable set + context refs; unserializable → server render error naming component, capture, value type.
- Untampered built-ins assumed (see memory/trust model). Compiled output opaque.
- Symbol ids `<module>#<Component>$<n>`, n = source order per module, identical in server and DOM builds.

## Scope cuts (deferred to later sub-projects)

- Structural children (JSX inside symbols, reactive child values that are non-primitive, `For` adoption) → SP2. Core: a child expression containing JSX compiles as today (static); a text binding whose value is non-primitive throws at render.
- `clientOnly`, `visible`/`idle`/`eager` preload strategies, impact scores, `island` → SP2. `when` triggers (`visible`/`idle`/`media`/`interaction`/`load`) for effects/client events ARE in Core (runtime-side).
- Router/lazy/Async continuation → SP3. Recorder works through async rendering (ALS) but regions stay single (root).

## File map

| File | Responsibility |
|---|---|
| `libs/reactivity/index.mjs` | + `_trackReads(fn)`, `_signalValue`, signal brand, `createContext(default, { id })`, provide observer hook |
| `libs/runtime/resume-format.mjs` | `encodeTable(values, hooks)` / `createDecoder(table, hooks)` |
| `libs/runtime/server-resume.mjs` | `renderResumable`, recorder ABI `_rOn/_rBind/_rAttr/_rModel/_rId/_rRef/_rRefCell/_rFn/_rComputed/_rEffect/_rClientEvent` |
| `libs/runtime/resume-loader.mjs` | `loader()` function (serialized inline via `String(loader)`) |
| `libs/runtime/dom-resume.mjs` | `createResume({ contexts })` client runtime |
| `libs/runtime/dom.mjs` | + `bindRef`, `clientEffect`, `clientEvent` (CSR semantics) |
| `libs/runtime/server.mjs` | + server `clientEffect` / `clientEvent` no-ops (non-resume compile) |
| `libs/compiler/resume.mjs` | capture analysis, symbol hoisting, ABI emission helpers |
| `libs/compiler/index.mjs` | `resume` option wiring; `ref`; `window:`/`document:` attrs |
| `libs/compiler/vite.mjs` | `rivet({ resume })`: symbol modules per component, manifest |
| `apps/playground/src/resume-demo.tsx` + server route `/resume` | counter + filter input resumed |

## Wire format (root state)

`<script type="rivet/state" data-region="0" data-events="click input">JSON</script>` then `<script>(loader)()</script>`. JSON (`<` escaped as `<`):

```
{ "v":1, "h":hash, "rt":runtimeUrl,
  "c":{ symId: url },                     // only symbols used on this page
  "t":[ ...object table ],
  "e":{ elId: { type: [symId, [capRefs]] } },
  "m":{ elId: [kind, signalRef] },
  "b":[ [nodeId, "t"|"a", attrName|null, symId, [capRefs], [depRefs]] ],
  "r":[ elIds bound to refs ],            // informational
  "fx":[ [symId, [capRefs], when, refElId|null] ],
  "ce":[ [symId, [capRefs], target, type, { passive, capture, once }, when] ] }
```

Table entries (slot = integer index into table; every value interned, primitives deduped):

| Entry | Value |
|---|---|
| JSON string / finite number / boolean / null | itself |
| `[r…]` | array (holes: `-1`) |
| `{"o":[key, r, key, r…]}` | plain object |
| `{"u":0}` | undefined |
| `{"n":"NaN"|"Infinity"|"-Infinity"|"-0"}` | special numbers |
| `{"g":"123"}` | bigint |
| `{"d":ms}` | Date |
| `{"m":[rk, rv…]}` / `{"e":[r…]}` | Map / Set |
| `{"s":r}` | signal |
| `{"c":symId,"a":[r…]}` | computed |
| `{"f":symId,"a":[r…]}` | hoisted local function |
| `{"x":tokenId}` | context value |
| `{"r":elId}` | ref-bound element |

Client target spec for `ce`: `"w"`, `"d"`, `["r", elId]`, `["m", query]`.

---

### Task 1: Reactivity hooks

**Files:** Modify `libs/reactivity/index.mjs`, `libs/reactivity/index.d.ts`; Test `libs/reactivity/tests/resume-hooks.test.mjs`

**Interfaces — Produces:**
- `_trackReads(fn) → { value, signals: Getter[] }` — runs fn untracked by outer observer; collects every signal getter read (directly or through computeds), first-read order, deduped.
- `_isSignal(fn) → boolean`, `_isComputed(fn) → boolean`.
- `createContext(defaultValue, { id }?)` → token with `id` (frozen).
- `_observeProvide(fn | null)` — process-wide hook called `(token, value)` from `provide` when `token.id` set.

- [ ] Tests: signal read collected; read through computed collected; nested `_trackReads` isolated; outer effect not subscribed by inner reads; `_isSignal(signal(1))` true, plain fn false; `createContext(0, {id:"x"}).id === "x"`; provide hook receives token/value only for id tokens.
- [ ] Implement: signal source gets `getter` back-ref; brand via module `WeakSet`s (`signals`, `computeds`) — no per-read cost; `_trackReads` installs a collector observer object `{ kind: 'collector', dependencies: Set }` as `currentObserver`; `track` already adds source to observer dependencies; computed sources are expanded to their signal leaves after run.
- [ ] Run `node --test libs/reactivity/tests/*.test.mjs` → pass. Commit.

### Task 2: Resume format

**Files:** Create `libs/runtime/resume-format.mjs`; Test `libs/runtime/tests/resume-format.test.mjs`

**Interfaces — Produces:**
- `createEncoder(hooks) → { ref(value) → int, table }` where `hooks.describe(value) → entry | undefined` lets the recorder encode signals/computeds/functions/contexts/refs (returns `{s: value}` style with raw values that encoder recurses into via `{ kind, ... }`). Concretely `hooks.special(value, ref)` returns a finished entry or `undefined`; throws `TypeError` naming type for unsupported (class instance, function, symbol, DOM node, WeakMap, Promise).
- `createDecoder(table, hooks) → { get(ref) }` memoized, cycle-safe; `hooks.signal(initialGetter)`, `hooks.computed(symId, captures)`, `hooks.fn(symId, captures)`, `hooks.context(id)`, `hooks.ref(elId)`.
- `escapeJSON(json)` replaces `<` with `<`, U+2028/2029.

- [ ] Tests: round-trip primitives, -0, NaN, ±Infinity, bigint, undefined, Date, Map, Set, nested arrays/objects, sparse holes; sharing (`a = {}; [a, a]` → same identity); cycles (`o.self = o`, map containing itself); refusal: class instance, function, Symbol, WeakMap, Promise → TypeError mentioning type; prototype-null objects allowed; `__proto__` key round-trips as own data property.
- [ ] Implement, run, commit.

### Task 3: CSR primitives — `ref`, `clientEffect`, `clientEvent`, `window:`/`document:`

**Files:** Modify `libs/runtime/dom.mjs`, `dom.d.ts`, `server.mjs`, `server.d.ts`, `libs/compiler/index.mjs`; Test `libs/compiler/tests/client-code.test.mjs` (Playwright, CSR) + compile-shape tests.

**Interfaces — Produces:**
- DOM: `bindRef(target, fn)` → calls `fn(target)` during setup.
- DOM: `clientEffect(fn, { when } = {})` → after mount (microtask), runs `effect` under captured owner; fn may return cleanup (runs before rerun and on dispose).
- DOM: `clientEvent(target, type, handler, { passive, capture, once } = {})` → `target` is `window`/`document`/Element/`"media:(q)"`; attaches immediately (CSR), removed on owner cleanup; handler runs in `batch`; passive default true for `scroll wheel touchstart touchmove touchend pointermove resize`.
- Server (non-resume): `clientEffect`, `clientEvent` → no-ops returning undefined.
- Compiler: `ref={expr}` → DOM `bindRef(slot, expr)`; server `omitted(expr)` (was attribute). `window:onX={fn}` / `document:onX={fn}` on a native element → DOM `clientEvent(globalThis.window|document, "x", (e) => fn-value(e))` statement; server `omitted(fn)`; unknown namespace → diagnostic.

- [ ] Tests (compile): server `ref` emits no attribute; `window:onScroll` server output omits markup; unknown `foo:onClick` diagnostic.
- [ ] Tests (Chromium CSR): ref receives element; clientEffect sees ref, reruns on signal change, cleanup on dispose; clientEvent window resize fires, removed after dispose; `window:onKeyDown` equivalent; media target uses `matchMedia(...).addEventListener("change")`.
- [ ] Implement, run, commit.

### Task 4: Compiler resume extraction

**Files:** Create `libs/compiler/resume.mjs`; Modify `libs/compiler/index.mjs`; Test `libs/compiler/tests/resume-compile.test.mjs`

**Interfaces:**
- Option: `compile(source, { target, filename, resume: { module: "src/app.tsx" } })`. Absent → unchanged output.
- Result adds `symbols: [{ name, id, component, captures: string[], code }]` (DOM target; `code` = ES module text `export const NAME = (c1, c2) => <expr>;` without imports) and `scope: string[]` (module-scope names referenced by symbols; DOM output appends `export { ...scope }` for non-exported ones).
- Server ABI (imported from `@rivetjs/runtime/server-resume` under unique aliases):
  - event attr → `_rOn(type, id, [caps])` slot (attribute position); `onXCapture` → diagnostic in resume mode.
  - dynamic attribute whose expression contains a call → `_rAttr(name, id, () => expr, [caps], ns?)`, returns attribute record.
  - child expression containing a call and no JSX → `_rBind(id, () => expr, [caps])`.
  - `model:kind={x}` → `_rModel(kind, x)` returns the signal (no symbol; the signal is the state).
  - `ref={(el) => (local = el)}` where `local` is a `let` assigned only in ref callbacks → `let local = _rRefCell()`; slot `_rRef(local)`.
  - after an element's last attribute slot, if it has any of the above → `_rId()` slot (renders ` data-r="n"` or nothing).
  - `clientEffect(fn, opts)` → `_rEffect(id, [caps], opts)`; `clientEvent(target, type, fn, opts)` → `_rClientEvent(id, [caps], targetSpec, type, opts)` with `targetSpec` = `"w" | "d" | refCellIdentifier | "media:..."` literal; `window:onX`/`document:onX` lower to `_rClientEvent`.
  - `computed(arrow)` (imported from `@rivetjs/reactivity`) in a component → `_rComputed(id, arrow, [caps])`.
  - local `const f = arrow|function` captured by any symbol → `const f = _rFn(id, arrow, [caps])`.
- Captures = identifiers referenced in the closure whose declaration lies inside the enclosing component function (params, locals) but outside the closure, first-appearance order. Module-scope declarations/imports are scope refs.
- Diagnostics (resume mode): JSX inside a symbol; capture of `this`; capture bound to `new` expression or a function not hoistable; `clientEvent` target not window/document/ref-bound/media literal; `onXCapture`; browser globals (`window`, `document`, `navigator`, `localStorage`, `sessionStorage`, `location`) read in component body outside symbols when unshadowed.
- DOM target in resume mode: same component output as without resume (CSR keeps working) + symbols + scope exports.

- [ ] Tests: capture sets (params, destructured props, nested scopes, shadowing, module refs excluded); server/DOM symbol name+id agreement over a fixture; ordering stable; each diagnostic; output without `resume` byte-identical to baseline for all compiler fixtures.
- [ ] Implement, run, commit.

### Task 5: Server recorder

**Files:** Create `libs/runtime/server-resume.mjs` (+ `.d.ts`), package export `./server-resume`; Test `libs/runtime/tests/server-resume.test.mjs`

**Interfaces:**
- `renderResumable(factory, writer, { signal, manifest })` → same contract as `renderToWriter`; `manifest = { hash, runtime, symbols: { [id]: url } }`; factory runs inside the recorder store; state + loader appended at the end iff recorder was used.
- `resumableToString(factory, options)` convenience.
- ABI functions per Task 4; outside a recorder store they degrade: `_rOn` → null; `_rBind` → plain value; `_rAttr` → `attribute(...)`; `_rModel` → attribute; `_rId` → null; `_rEffect`/`_rClientEvent` → undefined; `_rFn`/`_rComputed` → plain.
- Text binding output: `compiledTemplate(["<!--r" + id + "-->", "<!--/r" + id + "-->"], [value])` — only when deps non-empty; else plain value.
- Errors: unserializable capture → `TypeError("Cannot resume <symId>: capture #i is <type>")`.

- [ ] Tests: no-resume-calls page → output byte-identical to `renderToWriter`; counter fixture → `data-r`, text markers, state JSON shape; binding without signal reads → no markers; shared signal across two bindings interned once; computed dep → `{c}` entry and leaf signal deps; model emits `m`; ref cell resolves to element id; effects/client events recorded, bodies never run; async child (Promise) rendering still recorded (ALS); unserializable capture error message; state JSON escapes `</script>`.
- [ ] Implement, run, commit.

### Task 6: Client runtime

**Files:** Create `libs/runtime/dom-resume.mjs` (+ `.d.ts`), export `./dom-resume`.

**Interfaces:**
- `createResume({ contexts = [] }) → runtime` with:
  - `start(state, root = document)`; idempotent.
  - `ready(symIds) → boolean`; `load(symIds) → Promise`.
  - `dispatch(event, element, type) → { prevented: boolean }` sync; requires `ready`.
  - `deps(elId, type) → symIds` (handler + transitive capture symbols).
- Signals decoded via `signal(value)`; after decode each signal ref gets stub subscriptions for bindings listing it in deps: `effect(() => { s(); if (armed) activate(binding) })`. Activation: if symbols ready → sync real effect (text patch or `bindAttribute`); else load then activate.
- Model: on first event of the model type (`input`/`change`) → `state.set(el[kind])` (skip while `isComposing`), then `bindModel(el, kind, state)` under root owner.
- Effects/client events: scheduled per `when` (`load` → first idle slice after start; `idle` → `requestIdleCallback`; `visible` → IntersectionObserver on ref element; `interaction` → first `pointerdown`/`keydown`; `media:<q>` → when query matches). Run under root owner; errors dispatch `rivet:resume-error` (detail: symbol id) on document.
- Contexts: `{x:id}` → value from `contexts` by token id; missing → throw `Error("Missing resume context: <id>")`.

### Task 7: Loader

**Files:** Create `libs/runtime/resume-loader.mjs` exporting `loader` (self-contained function, no free vars besides browser globals); Test size ≤2048 brotli of `"(" + loader + ")()"` minified by esbuild-like oxc (`vite` transform) — measured via `rolldown`/`oxc-minify` from Vite deps.

Behavior:
- Startup: read `data-events`; `document.addEventListener(type, on, { capture: true, passive: !["click","submit","keydown"].includes(type) })`.
- Intent: `pointerover` (60 ms dwell, cancelled by `pointerout`), `focusin`, `touchstart` (passive) on a `[data-r]` element with handlers → modulepreload runtime + handler chunks; `pointerdown` / `keydown` → `import()` them (evaluate).
- Event: nearest `data-r` in `composedPath()` with entry for the type (or model kind). If runtime evaluated and `rt.ready(deps)` → `rt.dispatch` sync. Else: for unmodified primary-button click on `a[href]` (no `target`/`download`) or `submit`: `preventDefault`, load, dispatch, then replay (`location.assign(href)` / `form.requestSubmit(submitter)` with one-shot skip) unless handler prevented. Other events: load then dispatch with original event.
- Effects/client events present → boot runtime at first idle slice.
- Chunk failure: retry once; then `rivet:resume-error` on document; default listener reloads unless `preventDefault` on that event.

### Task 8: Browser E2E (compiled fixture, no bundler)

**Files:** Test `libs/runtime/tests/resume-browser.test.mjs`, fixture `libs/runtime/tests/resume/fixture.tsx`.

- Compile fixture for server (render HTML in node) and DOM (symbols → per-component modules served by `page.route`).
- Assertions: component functions never run in browser (counter on `globalThis.__componentRuns` incremented in component bodies → stays 0); before interaction only loader script executed (no module requests); hover → modulepreload requests; click after pointerdown → handler ran synchronously (`event.defaultPrevented` observable by test listener); counter text updates; attribute binding updates; filter input `model:value` updates text binding of matches (computed); link with handler and no preventDefault replays navigation; form submit replay; offline chunk → reload; `clientEffect` with ref on canvas runs at `visible` and reruns on signal change; `clientEvent(window, "resize")` and `window:onKeyDown` fire; `clientEvent` `once`.

### Task 9: Vite plugin — component chunk strategy + manifest

**Files:** Modify `libs/compiler/vite.mjs`, `vite.d.ts`; Test `libs/compiler/tests/vite-resume.test.mjs`.

- `rivet({ resume: { include?: RegExp | (id) => boolean, chunks: "component", entry?: string } })`.
- DOM transform of included files records symbols; plugin resolves virtual ids `\0rivet-symbols:<file>:<Component>` → module code `import { ...scope } from "<file>"; <symbol code>`; emits each as a dynamic-entry chunk (`this.emitFile({ type: "chunk", id })`) plus runtime entry (`entry` or virtual `export default createResume({})`).
- `generateBundle` writes `.vite/rivet-resume.json` `{ hash, runtime, symbols: { id: "/assets/x.js" } }`.
- Server transform of included files uses `resume: { module }` where module = root-relative path.
- Test: vite build of a two-component fixture → one chunk per component, chunk contains only its symbols (no component body text), manifest maps ids.

### Task 10: Playground `/resume` + gates

**Files:** Create `apps/playground/src/resume-demo.tsx`, `apps/playground/src/resume-entry.ts`; Modify `apps/playground/build.mjs`, `server.mjs`, `src/server.tsx`; Test `apps/playground/tests/resume.test.mjs`.

- Page: counter button + `<output>{count()}</output>`, filter `<input model:value={query}>` + `{matches()} of N examples` (computed over items), `window` resize client event updating a signal text, canvas clientEffect.
- Playwright: no component runs, counter, filter text, loader size, initial JS requests = 0 modules before interaction.
- Zero-cost: ssr-bench rendered HTML hash unchanged (compare against `git stash` baseline output stored in test as sha256 computed at plan time).

### Task 11: Docs

- `docs/guides/resumability.md`: usage, ABI, format, limits (Core), measurements (loader bytes, runtime bytes).
