# Function Bridge — design (2026-10-09)

- Status: **Phases 0–2 done (2026-10-12, Phase 2 closed by T29) except the Phase 1 context chain T14–T17 (context ids / frames / `createResume` contexts) and T20 (diagnostic renumbering RV2103–RV2106), parked after T31 (T14 blocked on UI-IDENTITY: it touches 169 ui/cdk files; T15–T17 / T20 follow it); Phase 3: 3a done (T30, 2026-10-12: `serializeAndRevive`, skew reload e2e, corpus flips); 3b done (T31, 2026-10-12: resume fuzz over the cdk / ui story apps, findings pinned with owners, §8.5).** Phase 0: design + failure corpus + baseline; C1 + C2 + skew fail-safe (lane BRIDGE-C1C2, 2026-10-09). Phase 1: T1–T13, T18, T19. Phase 2: T23–T28 (data classes, resource holders, `registerClass`, `reconstruct`, quick fix). Rulings and deviations: §12; results: §8.3. User-approved plan "Function Bridge" (phases 0–3); Phase 2 hybrid (auto data classes + explicit resource holders) chosen by the user.
- Lane BRIDGE-P0. Corpus: [`libs/runtime/tests/function-bridge-corpus-browser.test.ts`](../../../libs/runtime/tests/function-bridge-corpus-browser.test.ts) + cases [`libs/runtime/tests/resume/bridge-corpus.ts`](../../../libs/runtime/tests/resume/bridge-corpus.ts).
- Goal: any value a component captures resumes with plain-JS semantics. That covers functions anywhere, `let`, hoisting, `this`, classes, built-ins, contexts and library values. Each bridge succeeds or fails with a compile-time error that names the value. Calls stay synchronous, there is no extra fetch, and there is no prod regression.

## 1. Problem

### 1.1 Qwik complaint themes → bridge part

Research 2026-10-09: QwikDev issues, qwik-evolution, HN, Carniato. The issue numbers below are Qwik's.

| # | Qwik theme | Bridge answer |
|---|---|---|
| 1 | functions across `$` boundaries (ctx / props / stores / methods) — #3437 #7157 #617 #1171 #7091 | Reference bridge; calls stay **sync** (Qwik QRLs are async) |
| 2 | class instances "Code(3)" (ObjectId, ORMs, null-proto JSON) — #4371 #2270 #3449 evo#87 #3019 | Reconstruct: prototype restore by class symbol |
| 3 | `noSerialize` → `undefined` after resume, not reactive — #4973 #7445 #8003 | Reconstruct `reconstruct(() => …)`: lazy + reactive |
| 4 | capture rules: const only, hoisting #1807, hook placement #2117, whole-store over-capture #6920, "Missing Object ID" #4979 | Reference analysis: boxed `let`, late captures, narrow paths |
| 5 | first-click waterfalls — #6879 #4149 #6795 | not a bridge feature; rule: no extra fetch per revived function (co-chunk + `needs`) |
| 6 | chunk explosion / deploy skew — #5148 #7226 #3777 | content-stable symbol ids + fail-safe mismatch |
| 7 | `useVisibleTask$` used as an eager escape hatch — #4299 #3391 #9144 | Reconstruct removes the need |
| 8 | interop isolation (`qwikify$`) — #3986 #2651 | Reference for library callbacks, Reconstruct for library objects |
| 9 | context lost in layouts / SPA nav, no destroy hook across resume — #1648 #2254 evo#74 | Context bridge: revive under the recorded provider frame |
| 10 | debugging: numeric codes, minified traces — #4779 #6237 | named compile errors: capture path + source location + quick fix |
| 11–14 | store reactivity, `$` syntax, testing (#5515), hosting | only testing is in scope: Phase 3 `serializeAndRevive` |

### 1.2 Rivet today (corpus, 2026-10-09, HEAD + uncommitted RESUME-CTX hunks)

51 cases: 23 green, 28 red. Status codes:

- `compile`: compiler diagnostic.
- `render`: server render throws.
- `client`: browser error.
- `wrong`: no error, wrong result.
- `bytes`: the state over-captures.

Both projects agree, except `mutual-recursion`: prod `client` vs dev `render`, because `assertAcyclic` fires earlier in dev.

| Group | Green | Red (id: status) |
|---|---|---|
| container | obj-inline-fn, array-fn, map-fn, context-fn | obj-module-fn: render · assigned-fn: render · signal-fn: render |
| this | method-this, method-arrow-in-this, getter-object | — |
| closure | let-before, recursive, identity-twice, factory-captures, factory-inline | let-after-jsx: wrong (`"early"`; fixed T8) · let-shared-cell: wrong (cells not shared; fixed T8) · hoisted-declaration: render · mutual-recursion: client/render (cyclic fn entries) |
| shape | async-fn, generator | bound-fn: render |
| narrow | narrow-props (member capture) | narrow-object: bytes · narrow-store: bytes (whole store / object in state) |
| class | — | class-store, class-arrow-field, data-class, data-class-private, resource-class: compile ("class instances are not serializable") · data-class-nested: render (`User instance`) |
| builtin | bigint, null-proto | map-data, set-data, date, url, typed-array: **compile** (the compiler refuses `new X` although the encoder supports Map / Set / Date / URL) · regexp: render |
| library | library-fn, library-closure, prop-fn-into-map, comparator-sort | library-object: render (`.size` function) · library-fn-in-object: render |
| context | jsx-content-prop, closed-overlay-plain-children | context-in-handler: wrong (`default`) · context-in-binding: wrong (RESUME-CTX known limit) · context-row: wrong (unregistered context → identity default) |
| skew | — | skew-renumbered: **wrong**, the old page ran the new deploy's other handler (`WRONG`) |

Findings beyond the documented rules:

- **Some documented failures already work.** Array elements, Map values and library closures pass because a `const` derived through calls is re-created from its recipe symbol. That re-runs `memo(...)` and the `[() => …]` initializer in the browser. Side effects in such initializers run twice (server and browser).
  - The docs "Not covered" list (`docs/guides/resumability.md` R2) and `apps/docs/content/learn/resuming.md` are stale on this point. Phase 1 rewrites them anyway.
- **The compiler's `new` check is broader than the encoder.** `const d = new Date(…)` captured is a compile error, while `signal(new Date())` or a Date inside props encodes fine. This is the cheapest fix (§5 C1).
- **Deploy skew is silent.** Symbol ids are positional (`Component$n` in source order). Manifest `hash` is written to `state.h` and never read. `symbol()` does not check that the export exists.
- **Errors name capture indexes, not identifiers** ("capture #1 function is not serializable"). Dev adds the value path (`.size`).

### 1.3 Today's mechanism

Map with file refs; working tree 2026-10-09.

**Compiler** (`libs/compiler/rust/src/resume.rs`):

- Definite sites (`scan` :684):
  - JSX `on*` / bindings / attributes;
  - `clientEffect` / `clientEvent` / `computed`;
  - `equals`.
- R2 opportunistic Fn sites produce no compile diagnostics; problems surface at serialize time. They cover:
  - object-literal values and `return` values (`escaping` :698);
  - component props (`prop_value` :1502);
  - module refs as props or `const f = g` (`module_alias` :1604);
  - `alias_functions` :1689;
  - `user_helper` args :1725;
  - destructuring defaults :1644;
  - captured local functions (fixpoint :2370).
- Captures = free identifiers declared in an enclosing function (`free_names` :1811). Module-scope names are imports of the symbol module.
  - `this` is a diagnostic for definite sites and skips R2 sites.
  - Captures are an array literal evaluated **at creation** (`capture_list` compile.rs:2080). That snapshots `let`, and gives no shared cells except `ref` cells (`_rRefCell`).
  - Member captures (`props.a`) only for Spread / Styled sites (:2447).
- Ids: sites sorted by span → `{Component}${n}`, n module-global (:2545). Symbol module = `export const Name = (cap0, …) => (fnText)` (:2677).

**Server** (`libs/runtime/server-resume.ts`):

- `_rFn` stamps `{id, captures}` on the function (private-field `Recipe`, :343, :1845). `fnEntry` → `{f: id, a: refs}` (:2391).
- `special` (:2275) handles contexts `{x}`, ref cells, router, forward boxes, live props, accessor objects, objects holding signals (by value), signals `{s}`, computeds `{c, v?}`.
- The encoder (`resume-format.ts` :236–443) accepts:
  - plain / null-proto objects (`p` / `o` / `j` / `i`) and arrays;
  - Date `{d}`, URL `{h}`, Map `{m}`, Set `{e}`, bigint `{g}`, special numbers.
- It refuses functions without a recipe, symbols, and any other prototype (`"<Ctor> instance is not serializable"`).
- Identity: objects are interned per render (`objects` Map), so one function captured twice = one entry.

**Client** (`libs/runtime/dom-resume.ts`):

- Lazy memoised decode. A `{f}` entry calls `runWithOwner(root, () => symbol(id)(...captures))` **eagerly when the entry decodes**: there is no proxy and no async step.
- `symbol()` (:307) throws `Resume symbol is not loaded: <id>` when the chunk is absent. It returns `module[Local]` unchecked, so a missing export gives `undefined`.
- Chunks:
  - Handlers: the loader ensures the handler chunk + `needs` (reach through captures) before dispatch.
  - Bindings: `ready ? go : ensure.then(go)`.
  - A call is therefore always sync.
- Owners:
  - Handlers run under the resume root.
  - Bindings / effects run under their region owner.
  - Computeds run under their recorded provider frame (RESUME-CTX).
  - Region re-creation runs under `[12]` providers of `resumableContext` tokens.
- Load failure: one cache-busted retry, cancelable `rivet:resume-error`, reload at most once per URL per 10 s (loader `fail`).

## 2. Non-negotiables

1. **Sync signature.** A revived function is called exactly like the original: same arity, sync return, `this` as at the call site. Never a Promise or QRL wrapper.
2. **No extra fetch when the compiler sees the use.**
   - Every function reachable from a site's captures is in that site's chunk list (`needs`) and loads with it: same chunk, or prefetched with it.
   - A function reachable only dynamically is revived lazily, with a dev warning naming it, e.g. a value only a later streamed segment or a client-side write can reach. A missing chunk throws synchronously, as today.
3. **Content-stable symbol ids + fail-safe mismatch.**
   - An id changes only when that closure's code or captures change.
   - A page whose ids are missing from the loaded chunk reloads through the existing guarded `fail` path. It never runs another function.
4. **Compile-time named errors.** Anything the compiler can see and cannot bridge is an `RV2xxx` error that names:
   - the capture path (`store.conn`);
   - the source location (site + declaration);
   - a quick fix (move into the handler, `reconstruct(() => …)`, `static [revive]`, or plain data).
   - Render-time errors remain only for values the compiler cannot type. Those name identifier + path + site location (dev), never just an index.
5. **Zero cost.** Non-resume modules compile byte-identical. Pages that use no bridged shape keep identical state + HTML. Plain-render cost is unchanged.

## 3. Phase 1 — Reference + Context bridge

### 3.1 Content-stable symbol ids

- Id = `<module>#<Component>$<h>`:
  - `h` = the shortest prefix (≥ 3 base-36 digits, implemented by C1C2-SLIM 2026-10-09; first landed as a fixed 6) of a 64-bit FNV-1a digest that no other symbol of the component shares, over: the normalized closure source (oxc codegen of the closure, whitespace-free), sorted capture names + kinds, symbol kind, and the component name.
  - Collision / identical twins in one component: suffix `.k`, where k = ordinal among equal hashes in source order. Two identical closures are interchangeable, so an ordinal swap is harmless.
- Also hashed: each module-level reference symbol (`() => g`) and class symbol (§4) as `<module>#<name>`, with no hash because the name is the identity. An import ref is `<module>#import:<specifier>:<name>`.
- Wire: unchanged. Page symbol indexes stay; ids only appear in `state.s`, grouped by module (`wireSymbols`), so a hash adds ~5 B per page symbol before compression. Budget: §8.
- Skew check (runtime, prod):
  - `symbol()` treats `module[local] === undefined` (or `__rivet(id) === undefined`) as skew. It calls the loader's `fail`: cancelable `rivet:resume-error` `{ skew: id }`, then a guarded reload. It does not throw a TypeError later.
  - +~40 B min in `/dom-resume`.
  - Old pages that still reach old content-hashed chunk URLs keep working (immutable assets). New chunks without the old id fail safe.
- Optional boot check (open question Q1): runtime entry carries the manifest hash (`define`). `state.h !== hash` and a missing id together mean reload before the first handler. Not needed for correctness once ids are content-stable.
- Side effect: oracle / corpus symbol ids no longer renumber on unrelated edits. This needs a one-time re-record of every snapshot that pins ids.

### 3.2 Reference encoding

Existing entry `{f: sym, a: [refs]}`. New cases, all reusing it:

| Value | Server | Entry | Browser |
|---|---|---|---|
| module-level function / `const` function of a resume module, **anywhere** (object, array, Map, signal, assignment) | once per module load: `_rRef(f, "<module>#f")` stamps the recipe (no per-render cost) | `{f: sym}` (no `a`) | symbol `() => f` from the module's chunk |
| function imported (static import) into a resume module from a package / non-resume module | `_rRef(g, "<module>#import:pkg:g")` after the import (module load) | `{f: sym}` | symbol re-imports `g` (static import in the symbol chunk; counted in `deps`) |
| local function in any value position (argument, array / Map / Set element, assignment, `signal(f)`, class field arrow) | `_rFn(id, f, caps)` at creation (same as R2), with escape analysis: only when the value can escape the render, not for `xs.map((x) => …)` callbacks the render consumes | `{f, a}` | as today |
| hoisted function declaration | registration hoisted to the top of the enclosing body with **late captures** (§3.3) | `{f, a}` | as today |
| mutually recursive local functions (`even` / `odd`) | one **group symbol** returning `[even, odd]`; per instance the server registers the members array once (`_rGroup(id, [even, odd], captures)`): the array = one plain recipe `{f: group, a}`, each function = `{i: [group ref, k]}` (the decoder's existing array-element entry) | `k` = member index | group factory runs once per instance (the group entry is memoized like any recipe), identity kept; two instances = two group entries, never merged. Compiler (T10): the members must share one statement list (declarations registered in the hoisted prologue, else after the last `const` member); the group's captures are the union of the members' narrowed captures (T11 `_rMember(base, key)`, deduped by (base, key); a member needing the whole base widens it for the group) (T10 fix 1); an early exit between the first `const` member and the registration point is RV2011. Eligibility limit: Tarjan runs over declaration-keyed Fn sites only, so a cycle that passes through a `let` function binding or a holder (`api.even = …`) is not grouped ("Cyclic reference" as before). As landed (T9 fix 1): not a `{f, a, n}` / `{f, a, gm}` member entry — a member key would collide with `{n}` special numbers, and a (symbol, capture refs) group cache merged instances with equal (interned) captures; the recipe entry is also `plain()`-compacted / `{y}`-repeated for free |
| `f.bind(t, ...args)` where `f` is resumable | compiler rewrites to `_rBound(f, t, args)` (as landed T10: a captured local `const g = f.bind(…)` and its bound-of-bound chain, `f` a local function or a module function / import; fix 1: a bind const used by name anywhere a resumable value flows (captured, JSX prop, call argument, object / array store) is rewritten; inline `.bind` resumes in props / handlers through the props / `_rOn` recipes, not inside object literals (RV2014, only for a property a closure reaches); spread first argument RV2012; other callees (parameter, prop, library) RV2013; fix 2: warnings unless the callee is provably a function (then RV2012 / RV2013 errors); a `this`-dependent target stays RV2007 with `.bind(ctx)`) (calls the real `bind`, stamps `{k:"bind"}`; native `bind` reads the `bind` method off `f` before evaluating `t`/args, so the rewrite evaluates `f` first, then `t`, then args, and skips the stamp when `f.bind !== Function.prototype.bind` or the result is a primitive; bound-of-bound nests two entries). Limit: a bound `t` / arg that reaches the bound function back (`o.h = f.bind(o)`) is a capture cycle → "Cyclic reference" unless a `let` cell breaks it (same as any function entry) | `{k: "bind", a: [f, t, ...args]}` | `f.bind(t, ...args)` |
| `this` methods / getters on object literals | already resumable when the object is captured whole (corpus green); rule kept: a method needs the whole object | — | — |

**Library callbacks stay sync.** A revived function is a real function. `xs.sort(byDesc)` and `[1, 2].map(props.format)` call it synchronously (corpus green). Phase 1 keeps this by rule: never wrap in a lazy proxy when the chunk is in `needs`.

**Library objects holding functions** (`createChart()` result) are not Reference cases. They are Phase 2 `reconstruct`. The render error must say so (§3.6).

### 3.3 Captures: late reads, boxed cells, narrow paths

(The §2 table is the BRIDGE-P0 baseline; current statuses live in `libs/runtime/tests/resume/bridge-corpus.ts`.)

- **Late captures.** Today captures are read at creation; correct JS reads them at call time.
  - Server: `_rFn(id, f, () => [a, b])` (thunk). The encoder reads it at encode time, at the end of the render or segment, so code running after render sees final values.
  - Fixes `let-after-jsx` and makes hoisting possible: a declaration registered at the top would otherwise read TDZ bindings.
  - Cost: one closure per `_rFn` under the recorder only. When there is no recorder, `_rFn` returns `f` and the thunk is never created (the compiler emits `__rivetRec && …` or passes a module-level reader; measure both).
  - Applies to Fn / Event / Bind sites whose captures include a `let` or a hoisted name. `const`-only captures keep the array.
- **Boxed `let` cells.** A `let` assigned after a capture site, or assigned inside any closure, compiles to a cell in resume modules on both targets:
  - `let clicks = 0` → `const clicks$ = _rCell(0)`;
  - reads / writes become `clicks$.v`.
  - As landed (plan D13, T8): the cell keeps the binding's name (`const clicks = _rCell(0)`, `clicks.v`), no `$` suffix. Fix round 1: any write boxes (not only "after a capture site" / "inside a closure": source order is not execution order), and an eager handler expression (`onClick={h}`) captures the value `h.v`.
  - The encoder writes the cell once (interned entry `{k:"cell", a:[value]}`, at its first encode — Q2; runtime landed T7 2026-10-11), so every symbol capturing it shares one browser cell. That fixes `let-shared-cell`.
  - Cells are not reactive. That matches JS: a `let` is not a signal.
  - DOM target: the same rewrite only in symbol modules (the cell arrives as a capture). Main-module DOM code keeps plain `let`.
  - Zero cost for `let`s with no such assignment.
- **Narrow paths.** Member captures (today: Spread / Styled only) are extended to every site kind.
  - A local whose every use in the closure is a member read chain (`store.count`, `store.count.set`) is captured per path (`store$count`). The symbol prologue rebuilds the object via `__rivetMembers`.
  - Fallback to the whole object on any of: value use, call of a method that may use `this` (`store.inc()`), computed key, spread, write, `in` / `delete`, iteration.
  - Fixes `narrow-object`. `narrow-props` is green already.
- **Stores** (`@rivetjs/reactivity/store`):
  - Captured stores encode `{k: "store", d}` where `d` holds only paths that were read on the server, plus literal paths in captured code (compiler: string literals passed as `path` to `read` / `write` / `at` with that store as the first argument).
  - A dynamic path in captured code means the whole store, with a dev warning naming the site.
  - Fixes `narrow-store`. Needs a small `store.ts` hook (`_storePaths`) and a recorder path set.
  - As landed (T12 + fix 1 runtime, T13 compiler, 2026-10-12): entry `{k:"store", a:[root signal, nodes(, kept paths in dev)]}` (the signals carry pruned values, not a separate `d`); marks union per store + render; no narrowing while streamed segments are pending; compiler marks a `const` store only when EVERY reference in the module is `read` / `write` / `at` with a literal path (captured `at` views mark their store), otherwise whole store with no compiler warning — the dynamic-path warning moves to the language service (RV2104, T20); dev warns at runtime on a browser read of an unshipped path.

### 3.4 Context bridge

- **Every context of a resume module is resumable by id.** The compiler gives each `createContext(...)` declared at module scope of a resume module a content-stable id `<module>#ctx:<name>` (unless `{ id }` is set) and registers it. This makes `resumableContext(token)` a no-op: deleted in Phase 1, breaking change allowed; it is called at the token's definition. Context `id`s are already stable.
- **Recorded owner-context path for every revived thing.** The server keeps one frame table per render:
  - Frames: `[tokenRef, valueRef, parentFrame]`, interned per `Frame` object (`server-resume.ts` already reads `getOwner().ctx`).
  - Every handler, binding, effect, `clientEvent`, `{f}` recipe and computed records its creation frame index. The index is omitted when the frame equals its region's or when it is the root.
- **Browser:**
  - `dom-resume` builds `within(frame)` owners lazily (cached per frame index, as RESUME-CTX does for computeds).
  - Handlers dispatch, and bindings / effects run, under that owner. Recipe factories run under it too.
  - A `useContext` inside the handler / binding expression then reads the server's provider. This fixes `context-in-handler`, `context-in-binding` and `context-row`. The last needs the region `[12]` path for all tokens, not only `resumableContext` ones.
- **Value encoding:** provider values encode structurally (functions in them through §3.2). Unencodable provider values (a service object) are §4 `reconstruct`, or stay `createResume({ contexts })` entries (kept for app singletons).
- **Cost:**
  - 0 B on pages without providers around resumed code.
  - One frame list per page, plus one small int per site whose frame differs from its region's.
  - RESUME-CTX measured +0 to +58 B on ui showcases for computeds only. Budget for all sites: §8.

### 3.5 Co-chunking / preload rules

- A Reference symbol for a module function lives in that module's chunk. Its `deps` include the module's static imports, as today.
- Import refs live in the referencing module's chunk. The npm module is a static import of that chunk (no new request kind).
- `needs` (server `reachEntry`) already walks `{f}` captures. New entries (`bind`, `cell`, `store`, group members, frames) must be walked too (group members are `{i}` entries: `reachEntry` / `reachStack` / `reachesNone` / client `reachableSymbols` follow `i[0]` to the group recipe, T9 fix 1), so the loader evaluates everything a handler can call before it runs. Missing one breaks non-negotiable 2: test per kind.
- Dynamic-only reach is revived lazily on first decode: a function only reachable from a signal value that a later segment or a client write sets. If its chunk is absent:
  - prod: the existing sync `Resume symbol is not loaded` + `report`;
  - dev: `console.warn` once naming id + capture path, plus a quick-fix hint (`preload` directive or capture it statically).

### 3.6 Diagnostics

- New codes (registry `libs/compiler/codes.json`, RV2xxx range):
  - RV2101 `Cannot resume <path>: <Class> instance holds a resource` (Phase 2);
  - RV2102 `Cannot resume <path>: function from <pkg> stored in <container>` with fix "capture the import directly or use `reconstruct`";
  - RV2103 `Cannot resume <path>: dynamic store path` (warning, editor only);
  - RV2104 `Cannot resume <path>: Symbol / WeakMap / Promise`;
  - RV2105 `this outside an object literal method`.
- Every message carries `filename:line:col` of the capture site and the declaration span. The language-core quick fixes from §3.6 / §4 are added to `libs/language-core`.
- Render-time (dev): `refsOf` names the capture identifier (symbol `captures` names, shipped in the dev manifest) plus the path. It replaces "capture #i". Prod keeps index-free short messages.

### 3.7 ABI / format changes (Phase 1)

- Compiler ABI bump (runtime `package.json` `rivet.abi` + `libs/compiler/abi.ts`):
  - `_rRef`, `_rCell`, `_rBound`;
  - `_rFn` third argument may be a thunk;
  - group symbols;
  - frame recording (`_rOn` / `_rBind` / … read `getOwner().ctx` themselves, so no signature change).
- Resume format (`resume-format.ts`):
  - entries `{k:"cell"}`, `{k:"bind"}`, `{k:"store"}`, group recipes `{f, a}` + members `{i: [group, k]}`;
  - state `x` frame list;
  - entry field `fr` (frame index) on e / b / fx / ce rows, appended last;
  - the loader ignores it (loader bytes unchanged).
- Symbol id grammar: `$<hash>` / `$<hash>.<k>` instead of `$<n>`. `wireSymbols` `$suffix` compaction keeps working.

## 4. Phase 2 — Reconstruct (hybrid)

- **Built-ins first** (no API):
  - Compiler: the `new X` capture check allows the built-ins the encoder supports.
  - Format adds:
    - RegExp `{x: [source, flags, lastIndex]}`;
    - typed arrays / ArrayBuffer / DataView `{b: [kind, base64]}`;
    - URLSearchParams;
    - Error (name, message, own data; no stack in prod).
  - Fixes 6 builtin cases.
- **Data classes, automatic:**
  - A class declared in, or statically imported into, a resume module gets a module-load registration `_rClass(Cls, "<module>#class:Cls")`.
  - The encoder sees an instance whose prototype chain holds a registered class and encodes `{k: "cls", c: sym, d: fields}`. As landed (T23 + fix 1, 2026-10-12): `{cls, a: [own enumerable fields]}`; the instance's own class (first own `constructor` on its chain) must itself be registered — an unregistered subclass of a registered base is refused, naming the base (review M2); a chain reaching a built-in base is refused (review M1: native-code constructors, plus the platform classes Node implements in JS — EventTarget, AbortSignal, URL, Headers, streams, … — by global identity; a user class hung on `globalThis` stays a data base, re-review L1); an own `__proto__` field is refused:
    - `fields` = own enumerable data properties (encoded recursively);
    - private `#fields` read through a compiler-generated static accessor pair `static [Symbol.for("rivet.fields")](o)` / `…restore(o, d)`, emitted inside the class body, the only place privates are reachable.
  - Revive: `Object.create(Cls.prototype)` + restore public fields. **The constructor does not re-run** (documented; same as structuredClone of a class). Correction 2026-10-11: `Object.create` cannot restore private `#fields` — a private brand exists only on objects the class constructor ran on, so `restore(o, d)` throws on an `Object.create` instance. Classes with private fields need an explicit user factory (`static [revive]` below) that constructs a branded instance; the compiler-generated accessor pair only covers classes without privates. `data-class-private` therefore lands under `static [revive]`, not automatically.
  - Class fields holding arrow functions (`inc = () => this.c…`) are instance fields: the encoder sees a function without a recipe. The compiler wraps class-field arrows as `_rFn` with `this` as a capture (`{f, a: [selfRef]}`). The cycle through `self` is allowed: class entries decode in two phases (create object, then fill fields).
  - Eligibility check at compile time where visible: a field initialized from `new WebSocket` / `document` / `window` / a library call makes it a resource holder → RV2101 unless the class has `static [revive]` (below).
    - As landed (T24 + review fix 1, 2026-10-12): RV2102 (not RV2101, plan D7) for an instance `#private` element / `accessor` field, a class or member decorator (constructor-time `addInitializer` / class decorator code the browser skips), a field arrow reading `super` / `new.target` (its symbol cannot run outside the class; under `static [revive]` it stays an unlifted field), an `extends` other than a module-local data class, and the resource globals (`window`, `document`, `navigator`, `globalThis`, `localStorage`, `sessionStorage`, `WebSocket`, `EventSource`, `Worker`, `BroadcastChannel`) read in an instance field initializer or the constructor. Narrowed vs this paragraph (review L1, accepted): a library call (`pool = createPool()`) is not proven at compile time — its value fails at render when it is not serializable; a module-level `typeof window` conditional (`const w = typeof window … ; class R { win = w; }`) restores the value the server serialized (`null`). Registered and sound (the same module code runs in the browser): prototype mutation, a reassigned class binding (the symbol reads it live), static blocks, computed keys, static `#private`, TS parameter properties. Message tail: "create it inside the handler or give X a static [revive]" (`reconstruct` returns with T27).
  - Classes from packages (bson `ObjectId`) work only when imported by a resume module (static import → class symbol). Their privates are not reachable: the render error names the class + field, with fix `static [revive]` via a registration helper `registerClass(ObjectId, { serialize, revive })` in the app's resume entry.
  - Fixes class-store, class-arrow-field, data-class, data-class-nested; data-class-private via `static [revive]` (see correction above).
- **Resource holders, explicit**, two forms:
  - `static [revive](data) { return new Conn(data.url); }` + `[serialize]() { return { url: this.url }; }`. The symbols `serialize` / `revive` are exported from `@rivetjs/runtime/resume-format`; the instance encodes `{k:"cls", c, d: serialize()}`. Revival is **lazy**: the decoder returns the instance on first decode, so no work happens before the first use.
    - As landed (T25, 2026-10-12): entry `{cls, a: [ref(serialize() data)], rv: 1}` (plan D6). `[serialize]` (own or inherited) beats the data-field proof; a built-in base is fine (the reviver constructs); the compiler registers own / inherited `static [revive]` classes like data classes (never RV2102). `[serialize]` without a reviver is `RV2102: <Class> has [serialize] but no static [revive]` at encode (dev + prod). Decoder (on-demand `resume-builtins` chunk): data first — class instances inside it complete before the reviver reads it — then `Cls[revive](data)`; the core decoder only marks the entry BUSY, so a cycle back to the instance through its data throws. Deviation (T25): `registerClass(cls, { id, serialize?, revive })` takes a required wire `id` (unique, no `#`): package classes have no class symbol (importers never register imported classes, T24) and class names are minified in browser bundles. The entry's `cls` is then that string (never a page symbol index, no need / chunk); the browser finds the hooks by id in a `Symbol.for("rivet.classes")` registry, filled by the module calling `registerClass`, which the app imports from its server code and its resume entry. A taken `id` with another class throws; the same class again replaces its hooks.
    - Review T25 fixes (2026-10-12): a `static [revive]` class lifts no field arrows (M1: its reviver constructs; a lifted arrow reading `#private` would not parse); the `registerClass` id check (non-empty string, no `#`) runs in prod too (L1, wire invariant); a cycle through a holder's data names it (`Cyclic reference through revive of <id | Class>`, L2); read-order dependence documented + pinned (L3: holder first throws, a function capturing the inner instance first decodes).
  - `reconstruct(() => new Conn(url))` from `@rivetjs/runtime`:
    - returns an accessor `conn()`;
    - server: runs the factory once per render;
    - browser: the recipe symbol (factory + captures) runs on the first read under the recorded owner / frame. It is reactive: a factory reading signals re-runs, and the owner disposes the old value (`onCleanup` inside the factory).
    - Answers Qwik #3 / #7 (no eager `useVisibleTask$`).
  - Library objects (`createChart(4)`): `reconstruct(() => createChart(4))`. The render error for a library object (`.size: function is not serializable`) suggests it, with the path.
    - As landed (T26 runtime, 2026-10-12): `reconstruct` exported from `@rivetjs/runtime/dom` + `/server` = `computed(factory, { equals: false })` (lazy; not `clientOnly`: the server runs it when a render reads it). Refusals: `function is not serializable: build it inside the component, or a library object with reconstruct(() => …)` (dev: prefix + hint `function` with the same advice); a user-class instance names `reconstruct(() => new X(…))` / `static [revive]` and `registerClass(X, …)`; native built-ins keep the short text. Corpus `library-object` bridge outcome = that render error. Resume sites (no value encoded, factory on first browser read) = compiler C14, T27.
    - As landed (T27 compiler, 2026-10-12): `reconstruct(f)` from `@rivetjs/runtime/dom|server` = `SiteKind::Computed` with `{ equals: false }` (`__rivetR_computed(id, f, [caps], { equals: false })`); the factory's captures follow the ordinary rules (RV2003 at a class-instance capture inside it). RV2003 / RV2102 texts name `reconstruct`. Corpus `resource-reconstruct` / `library-object-reconstruct` pass. T26 review folded in: prod refusal `function is not serializable: build it inside the component, or a library object with reconstruct(() => …)`; module-level server singletons = one instance per process (documented).
- Otherwise: a compile error naming the field (RV2101), or a render error with path (dev).

## 5. Compiler work items (patch tasks for the root; never edited by lanes)

| Id | Phase | What | Files | Oracle impact |
|---|---|---|---|---|
| C1 | 2 (do first, tiny) | `new` capture check: allowlist Map / Set / Date / URL / URLSearchParams / RegExp / typed arrays / ArrayBuffer / Error | `resume.rs` :2502 | none (fewer diagnostics) |
| C2 | 1 | content-stable ids (hash + twin ordinal) | `resume.rs` :2545 | every resume snapshot re-records once |
| C3 | 1 | `_rRef` module-load registrations for module functions + imported functions of resume modules; symbols `() => g` | `compile.rs` module epilogue, `resume.rs` scope | resume modules only |
| C4 | 1 | escape analysis: `_rFn` for local functions in argument / array / Map / assignment / `signal()` / class-field positions; consumed callbacks excluded | `resume.rs` `escaping` | resume modules only |
| C5 | 1 | late captures (thunk) for sites capturing `let` / hoisted names; hoist declaration registrations | `compile.rs` `capture_list`, `resume_node` | resume modules only |
| C6 | 1 | boxed `let` cells (`_rCell`, `.v` rewrite) on both targets of resume modules + symbol modules | new `rust/src/compile/resume_cells.rs` | resume modules only |
| C7 | 1 | narrow member captures for every site kind (generalise Spread / Styled `member_captures`) | `resume.rs` :1870–1997 | resume modules: capture lists change |
| C8 | 1 | mutual-recursion group symbols | `resume.rs` fixpoint :2370 | rare |
| C9 | 1 | `.bind` → `_rBound` rewrite for resumable callee | `compile.rs` | rare |
| C10 | 1 | auto context ids for module-scope `createContext` in resume modules | `resume.rs` / `compile.rs` | resume modules with contexts |
| C11 | 1 | store literal-path collection on `read` / `write` / `at` calls inside captured code → `_rStorePaths(store, [...])` (as landed T13 + fix 1: every reference in the module, views followed recursively — any non-`read` / `write` / `at` use of a view keeps the whole store; `rust/src/resume/stores.rs` + `compile.rs` `resume_node`) | `resume.rs` `scan_call` | resume modules with stores |
| C12 | 2 | `_rClass` registrations + static field accessor pair inside class bodies; class-field arrows as `_rFn` with `this` capture | new `rust/src/compile/resume_classes.rs` | resume modules with classes |
| C13 | 1–2 | diagnostics RV2101–2105 (messages, spans, codes.json, quick fixes) | `diagnostics.rs`, `codes.json`, `libs/language-core` | — |

Each patch: unified diff + `.md` (expected emission before / after for 2–3 corpus cases, verify = flip those `bridge:` cases).

## 6. Phase 3 — Test helper + fuzz

- `serializeAndRevive(value, { symbols })` in `@rivetjs/runtime/testing`:
  - encodes through a recorder, decodes in Node with the symbol modules compiled via the test register;
  - returns the revived value;
  - fails with the same named errors.
  - Answers Qwik #5515: unit-testing resumability without a browser.
- **Resume fuzz:**
  - Every ui / cdk story app route is rendered resumed and CSR.
  - Drive each interactive element: click, type, keys from `navigationKeys`.
  - Compare DOM text + attributes after each step. Any `rivet:resume-error` or component run fails the test.
  - Budget: Chromium, `--maxWorkers=1`, sharded per story app.
- **Skew reload e2e:** build v1 + v2 of a fixture app, serve v1 HTML with v2 chunks, assert a reload and no wrong handler. Promote corpus `skew-renumbered`.
- The corpus `today` pins flip case by case. Each phase updates `today` and removes the `test.fails`.
- As landed (T30): `serializeAndRevive(make, { symbols, platform, contexts, state })` + `serializeValue(value)` + `importResume(url, "server" | "browser")` in `@rivetjs/runtime/testing/resume` (rulings and details §12); skew e2e `libs/runtime/tests/resume-skew-browser.test.ts`; results §8.3.
- As landed (T31): `@rivetjs/testing/fuzz` (`libs/testing/fuzz/`) + vitest projects `cdk-resume-fuzz` / `ui-resume-fuzz` (`libs/{cdk,ui}/tests-fuzz/`), CI job `resume-fuzz`; component runs are detected as server nodes the resumed page replaced while the client render kept them; results §8.5, rulings §12.

## 7. Migration (docs rules deleted)

Breaking changes are allowed: experimental, no shims. Delete or rewrite, in the same change as each phase:

- `apps/docs/content/learn/resuming.md` "Cannot be captured" column → only symbols / WeakMap / Promise / resource classes without `revive`.
- `docs/guides/resumability.md` "Resumable functions (R2)" "Not covered" list + "Diagnostics: R2 sites are opportunistic" + Limits "Capture errors name the capture index" + "Contexts in the browser" limit.
- `apps/docs/content/gotchas/function-is-not-serializable.md` + `best-practices/serializable-captures.md`.
- Root `CLAUDE.md` Rules "Resumability" bullet: module functions stored in objects, JSX content props.
- `libs/runtime/CLAUDE.md` gotchas ("Module-level / imported functions…", RESUME-CTX "Not done for … handlers"), `libs/compiler/CLAUDE.md` R2 notes.
- `resumableContext` call sites: cdk / ui / router `useSearchParams` identified context.
- AI outputs: `libs/mcp/ai` rules (regenerate via `node libs/mcp/ai/sync.ts`), llms outputs (`docs-kit llms`).
- `test.fails` known-limit test in `resume-owner-context-browser.test.ts`.

## 8. Perf budget

- State bytes: ≤ +2% on ui showcases (dashboard / mail / chat / settings) and ssr-bench `/resume` (0 / 1000 rows), brotli. Pages using no bridged shape: identical, except the id-hash suffix (counted in the 2%).
- Encode / resume SSR CPU: ≤ +2% in-process (interleaved A/B, ≥ 5 rounds, load < 4).
- Browser: first-click paint unchanged (resume-bench slow `click` / `keyClick` / `filter` within noise). `/dom-resume` growth reported; target ≤ +600 B min for Phase 1.
- Plain (non-resume) render and DOM benches: byte-identical builds (zero-cost gate).

### 8.1 Baseline (2026-10-09, HEAD ea064b55 + working tree)

Host load 11–22 throughout (BENCH-DOCS and other lanes running), so no timed A/A was run.

- **State bytes**: deterministic. Harness `$S/perf/BRIDGE-P0/bytes.tsx`, resume SSR in-process.

  | Page | HTML B | state B | state gz | state br | `"f":` entries | ms min / med (noisy) |
  |---|---|---|---|---|---|---|
  | showcase-dashboard | 73,215 | 26,638 | 7,577 | 6,149 | 170 | 1.975 / 2.107 |
  | showcase-mail | 57,904 | 30,123 | 9,537 | 7,957 | 155 | 1.485 / 1.647 |
  | showcase-chat | 64,296 | 33,887 | 9,194 | 7,371 | 233 | 2.078 / 2.140 |
  | showcase-settings | 42,460 | 29,342 | 8,254 | 6,640 | 217 | 1.418 / 1.477 |

- **Encode share**: from RESUME-COMPILE (profile, dashboard). Encode = 35% of `resumableToString`: value 14.6, structural 20.5.
  - Phase 1 work lands in "value" (frames, cells), "structural" (`needs` walks new kinds) and the recorder (late captures).
- **ssr-bench `/resume`**:
  - in-process from IMPL-ENCODE / R-PLAN 2026-10-09: 0 rows 0.106 ms CPU; 1000 rows 1.85 ms, 3.47 MB alloc;
  - Docker: c1 1000 rows 2.20 ms CPU/page (IMPL-TRANSPORT). Not re-run (no Docker full runs from lanes).
- **resume-bench** (last run 2026-10-08T08-47, Rivet lane, slow profile, 5 reps, p50):

  | Metric | Value |
  |---|---|
  | click paint | 32.2 ms (latency 15.1) |
  | keyClick paint | 13.6 ms |
  | tapClick paint | 32.2 ms |
  | hoverClick paint | 25.1 ms |
  | filter paint | 91.1 ms (first input sync 5/5) |
  | navigate paint | 39.0 ms |
  | JS before interaction | 20,828 B |

  Phase 1 gate: re-run with `--lanes rivet --conditions slow --repeats 10` interleaved with a HEAD build when load < 4.

### 8.3 Phase 2 result (T29, 2026-10-12)

Setup:
- A = `2632b773^` (before T23). B = HEAD `788f8356`.
- X = A's app / ui / cdk sources with B's `libs/runtime` + `libs/reactivity` + `libs/compiler`. X isolates runtime + compiler changes from other lanes' source edits.
- Host load 6–11 throughout. The bench lock never cleared under load 4 in 30 min, so the timed runs are the loaded-host interleaved variant.

- **State bytes (G-BYTES)**, deterministic, harness `$S/bridge/t29/bytes29.tsx`, resume SSR in-process:
  - **X vs A: identical** on all 22 pages:
    - 9 ui showcases: auth, chat, dashboard, mail, music, pricing, settings, storefront, storefront-product;
    - ui examples: table, date-picker, tabs, accordion, data-grid;
    - cdk examples: bento-dashboard, table, date-picker, combobox, tree, tabs, listbox, calendar.
  - None of these pages captures a class instance, so Phase 2 costs 0 B in state. Budget ≤ +2%: met.
  - B vs A also includes other lanes' source edits (UI T21 / T22):
    - settings 6,043 → 6,278 B br (+235);
    - ui tabs-basic 2,325 → 2,523 B br;
    - the other pages move −25 … +27 B br.
  - The kanban showcase needs a router owner and storefront-checkout needs loader data, so the in-process harness skips both.
- **Encode / resume SSR CPU**, A vs X, interleaved 3 rounds × 7 reps, min:
  - total over the 22 pages 25.95 → 26.41 ms (+1.8%);
  - per page −8.2 … +13.4% under load 6–8. The per-page spread is load noise; the budget (≤ +2%, load < 4, ≥ 5 rounds) needs a quiet-host re-run.
- **resume-bench**, rivet lane, slow profile, A vs B interleaved A B A B, 10 runs each, load 7–11, medians:

  | Metric | A | B |
  |---|---|---|
  | click paint (latency) | 31.8 ms (14.4) | 32.3 ms (15.2) |
  | keyClick paint (latency) | 9.4 ms (2.8) | 9.3 ms (2.5) |
  | JS before interaction | 24,626 B | 24,956 B (+330, all lanes) |
  | document | 10,255 B | 9,657 B (other lanes) |

  First-click paint is unchanged within noise.
- **Runtime entry sizes, min B**, per Phase-2 commit (zero-cost `runtime-hashes`, commit^ → commit):
  - T23 2632b773: server-resume +779, dom-resume +292, resume-format +301. Superseded: 7a1a01dd (RESUME-KEEP-ROWS) committed these files from pre-T23 copies and wiped T23; fix 1 re-landed it. Not counted in the totals.
  - T23 fix 1 650cf973 (re-land, against pre-T23): server-resume +1,191, dom-resume +64 (+22 br), resume-format +98, resume-builtins +226 (+59 br).
  - T24 921046be: server-resume +467.
  - T24 fix 1 f1faa8d3: server-resume +128.
  - T25 b5eb56d7: server-resume +750, dom-resume +16 (+8 br), resume-format +563, resume-builtins +511 (+217 br).
  - T25 fix 1 bba94b59: resume-format +145, resume-builtins +271 (+112 br).
  - T26 d20ad2ca:
    - server +2,867 (the export-all entry reaches `computed`; tree-shaken in apps);
    - dom +57 (+31 br), server-resume +439, resume-format +437.
  - T27 9546c8f5: server-resume +5, resume-format +5.
  - T28: none.
  - Phase 2 total, entry by entry: server-resume +2,980, server +2,867, resume-format +1,248, resume-builtins +1,008, dom-resume +80, dom +57.
  - The entries overlap, so the columns do not add up. Each entry is bundled with its import graph: dom-resume contains the resume-format decoder, and server-resume contains the encoder (T26: server-resume +439 ≈ resume-format +437 without a server-resume.ts change). The resume-format delta is mostly encoder and `registerClass` code.
  - Real browser cost:
    - dom-resume +80 B min / +30 B br on every resumed page;
    - resume-builtins +1,008 B min / +388 B br, only on pages whose state holds a class instance or another built-in entry;
    - `registerClass` code only in apps that import it.
- **Zero-cost at HEAD** (no `--update`): dev leaks none (217 entries), condition parity ok (18), corpus 227/227. The runtime / packages / lanes hash deltas against the recorded baselines include every lane since the last update; the Phase-2 share is the list above.

### 8.4 Phase 3a result (T30, 2026-10-12)

- `serializeAndRevive`: 14 tests (runtime + runtime-dev): primitives / built-ins, closures + `let` cell + signal, `_rMod`, a `clientEffect` registered inside `make()` (the value's effect is picked by symbol), `_rClass` / `static [revive]` / `registerClass`, narrowed store (unread field absent from the state), `reconstruct`, cycle, `platform`, refusals equal to a compiled page's render message (closure without a symbol, unregistered `EventTarget` subclass, WeakMap, Promise, runtime RV2102 `[serialize]` without `static [revive]`) + `#private` compile refusal + plain-`.ts` closure, `contexts` + `Missing resume context`, skew via `symbols`, the docs example, a drift guard (dom-resume's entry kinds + error messages present in the helper's hook copy).
- Decode-side messages equal Chromium's (T30 fix): `Missing resume context` (`tests/serialize-and-revive-browser.test.ts`) and the skew message, production and development decoder (`tests/resume-skew-browser.test.ts`; the runtime-dev project serves `dev/on.ts` to the page).
- Skew e2e (Chromium): `skew-renumbered` = right handler, no reload, no error; `skew-changed` = one `rivet:resume-error` `{skew}` on v1 with the production decoder message (the helper's), exactly one reload, no handler ran on the v1 document. `skew-renumbered` was already passing in the corpus (content-stable ids, T5/T6); nothing to promote.
- Corpus (192 tests): `data-class-private` flipped to its named error (`bridge` compile, D-priv) + new `data-class-private-revive` (passes). Remaining pins (`test.fails`):

  | Case / test | Today | Flips with |
  |---|---|---|
  | `context-in-handler` | wrong (`default`) | T15 (site frames), blocked on T14 / UI-IDENTITY |
  | `context-in-binding` | wrong (`default:1`) | T15 |
  | `context-row` | wrong (`<a>b`) | T16 (auto context ids) after T14 + T15 |
  | `method-this-member` | render (`function is not serializable`) | no task: a method read off another object as a value (`store.inc = base.inc`); needs a compiler site for member-read functions (unowned, spec Q-list) |
  | `resume-owner-context-browser.test.ts` known limit | binding sees the context default | T15 |
  | `resume-root-show` (`test.todo`) | a component-root `<Show>` re-runs the component on the first change | no task (not Function Bridge: the root region was tried and reverted 2026-10-09) |

- Bytes: runtime entries unchanged (`dom`, `dom-resume`, `server-resume`: identical hashes); zero-cost lines: `@rivetjs/runtime/testing/register` 1,576 → 2,625 B min (resume mode), new `@rivetjs/runtime/testing/resume` 91,748 B min (dev-only test entry: bundles the server recorder + decoder).

### 8.5 Phase 3b result (T31, 2026-10-12)

- Runs (default seed, ≤ 40 steps/route, single process): first run cdk 60 routes, 2,179 elements, 1,623 steps, 384 s; ui 119 routes, 1,731 elements, 2,690 steps, 881 s. After fix round 1 on HEAD a3e58f97 (2026-10-13): cdk 61 routes, 2,637 elements, 1,674 steps, 614 s; ui 103 routes, 1,537 elements, 2,393 steps, 773 s (CI: 3 shards per app).
- Bridge scope: 0 `rivet:resume-error`, 0 page errors, 0 reloads on both apps. No Function Bridge bug found; every real finding is a component / runtime / router difference, pinned with an owner (`libs/{cdk,ui}/tests-fuzz/pins.ts`: open = `test.fails`, design = filtered).
- Root-cause groups (open):
  - Re-created on the first change (component without its own region): cdk autocomplete, grid-list, lightbox, selection-indicator(-groups), slots, tag-group; ui action-bar grid, avatar-group, data-grid, resume surface, segment indicator, toggle-buttons, tag-group; follow-on `missing` (bound element left the page) on slots / tag-group / data-grid.
  - Server vs client attribute drift: DateSegment `aria-label="month, "` + `aria-labelledby` (4 routes), overlay `inert` on the wrapper vs on each sibling (3), TabPanel `tabindex=0`, TagList / Switch / field Label links (`aria-labelledby`, `aria-describedby`, `for`), Switch generated-id order, DisclosureGroup disabled state + key stepping.
  - Cold first interaction: mousedown focus before the chunk loads (runtime; fixed 2026-10-12 a3e58f97, except the NumberField stepper announcer), cold hover (runtime), focus-visible modality on the first press (cdk; fixed a3e58f97: loader records `__rvIM`), Select popover anchor 24 px off (cdk).
  - Mount-time effects (client render only): `--tab-panel-height`, ScrollArea overflow, SelectionIndicator `data-entering`.
  - Router: same-page `#hash` link focus (client router focuses the target; a resumed page has no router booted). Fixed 2026-10-12 (acfda1a9): the router's click listener is delegated, links whose propagation is stopped reach it through a capture companion.
- Harness false positives fixed in the normaliser / driver (not pinned): trusted navigation click (link kept until the navigation finishes), window marker for document loads, parsed `style` compare, router focus `tabindex=-1` + announcer, dangling IDREFs, generated-id renumbering, pointer parked at one spot on both pages, long-lived requests ignored by settle, input `value` attribute.
- Fix round 1 (review T31, 2026-10-13): exact-triple tolerance, pins on the `diff` only (+ `step`), comparison ends but the route keeps running on a structural difference, generated ids numbered in attribute-name order (a client that sets `aria-labelledby` after mount swapped the numbering: ui `/toggles` pin gone), focus restored after the router's move (cdk `/select-autofocus` is a real finding now: a client render never focuses an `autoFocus` trigger), post-parse `modulepreload` links dropped on the resumed page. COLD_* routes 3 runs in a row, identical findings: cdk `/forms`, `/links`, `/number-field`, `/radio-group`; ui `/cell-select-cold`, `/cell-select-dev`, `/inline-select-cold`, `/pickers`, `/select-cold`, `/visual/card`, `/visual/select`, `/visual/select-variants`, `/disclosure-group`. Not deterministic (design, narrow `diff` + `step` pins): ui `/colors` hover (1 of 6: 1 of 3 COLD runs, 0 of 3 `/colors` reruns in fix round 2 — a Home key scrolls the listbox under the parked pointer, frame timing, not chunk loading), ui `/ai-chat` streamed reply (steps 26 / 33, 2 of 7 runs each), cdk `/dom-events-collections` enter log (3 of 5 runs at step 16, one extra `scrollable-enter` / `vp-enter` entry on either page — possibly a real double-fire, cdk follow-up).
- Fix round 2 (re-review of 1c5c6b87, 2026-10-13): ui `/colors` design pin restored (a3e58f97 had dropped it), `/ai-chat` streaming + cdk `/dom-events-collections` hover / enter-log pins narrowed to the observed lines + `step`, 3-run rule written into the guide "Fuzz" + `libs/testing/CLAUDE.md`, node unit test `libs/testing/tests/fuzz-helpers.test.ts`.


- Pin tables below: state after the CDK-PINS / RESUME-PINS fix rounds and T31 fix round 1 (2026-10-13); the root-cause groups above describe the first run.

#### cdk: 30 pins (16 open `test.fails`, 14 design) — open by owner: cdk 12, runtime 4

| Route | Kind | Owner | Status | Finding |
|---|---|---|---|---|
| `/carousel` | load | cdk | design | carousel engine starts on the first interaction on a resumed page, at mount in a client render |
| `/carousel` | mismatch | cdk | design | carousel engine state (in-view slides) follows its start |
| `/resizable` | load | cdk | design | `onLayoutChange` at mount: a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/select-autofocus` | load | cdk | open | Select autoFocus: a client render never focuses the trigger (the focusable `clientEffect` calls no `focus()`, probe 2026-10-12); a document load focuses it through the native `autofocus` |
| `/grid-list` | load | cdk | design | rows without a description keep the server `aria-labelledby` (no server createSlotId check since UI-COLD 2026-10-08, documented deviation) |
| `/render-resumed` | load | cdk | design | rows without a description keep the server `aria-labelledby` (no server createSlotId check since UI-COLD 2026-10-08, documented deviation) |
| `/selection-indicator-groups` | load | cdk | design | rows without a description keep the server `aria-labelledby` (no server createSlotId check since UI-COLD 2026-10-08, documented deviation) |
| `/dom-events-collections` | mismatch | cdk | design | TabPanels size variables (transition between panel sizes): a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/selection-indicator` | mismatch | cdk | design | TabPanels size variables (transition between panel sizes): a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/tabs` | mismatch | cdk | design | TabPanels size variables (transition between panel sizes): a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/selection-indicator-groups` | load | cdk | design | SelectionIndicator entrance: a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/dom-events-collections` | mismatch | cdk | design | non-deterministic (3 of 5 T31 runs, always after PageUp): the enter log differs by one `scrollable-enter` / `vp-enter` entry, on either page; may be a real double-fire of the ScrollView / viewport enter event (cdk follow-up), filtered meanwhile (ends the DOM comparison that run) |
| `/live-props` | mismatch | runtime | design | timing-dependent (first seen 2026-10-13, fix round 1): a listbox moves under the parked pointer, which option `pointerover` hits depends on frame timing (same class as ui /colors) |
| `/autocomplete` | recreated | cdk | open | Autocomplete ListBox re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/grid-list` | recreated | cdk | open | GridList rows re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/lightbox` | recreated | cdk | open | Lightbox slides re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/dom-events-collections` | mismatch | runtime | design | timing-dependent (seen in 1 of 2 runs): replayed hover not cleared by the next key: cold hover: the pointer entered before the hover handler's chunk loaded; no hover start is replayed |
| `/scheduler-zone` | load | cdk | design | scheduler: documented deviation (libs/cdk/scheduler/CLAUDE.md "Pass `timeZone` on SSR pages"): without `timeZone` the server lays out in UTC and the resumed page keeps UTC; the story omits `timeZone` on purpose, the client render uses the browser zone |
| `/scheduler` | resume-error | cdk | open | scheduler (T-lane): SchedulerMonth resumed symbols read fields of an undefined cell / week (`label`, `dayNumber`, `segments`, …) after month-grid keys (CDK-PINS fuzz 2026-10-12) |
| `/number-field` | mismatch | runtime | open | cold first stepper press: the replayed pointerdown (press start) runs while the native mouse focus still sits on the stepper button, so RA NumberField announces the new value (live announcer) that a loaded page, focusing the input first, does not |
| `/region-state-repro` | recreated | runtime | open | repro route of the region re-creation limit: re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/region-state-repro` | recreated | runtime | open | repro route of the region re-creation limit: re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/region-state-repro` | recreated | runtime | open | repro route of the region re-creation limit: re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/selection-indicator-groups` | recreated | cdk | open | SelectionIndicator re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/slots` | recreated | cdk | open | slotted Input re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/slots` | missing | cdk | open | follows the slotted Input re-creation (the bound element left the resumed page) |
| `/tabs` | load | cdk | open | TabPanel: the server writes tabindex=0 (cannot see tabbable content), the client render drops it (RA useHasTabbableChild; needs a runtime post-children attribute, CDK-PINS request) |
| `/tabs` | mismatch | cdk | open | follows the server TabPanel tabindex=0 (the panel takes focus on the resumed page) |
| `/tag-group` | recreated | cdk | open | Tags re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/tag-group` | missing | cdk | open | follows the Tag re-creation (the bound element left the resumed page) |

#### ui: 27 pins (17 open `test.fails`, 10 design) — open by owner: cdk 7, runtime 2, ui 8

| Route | Kind | Owner | Status | Finding |
|---|---|---|---|---|
| `/ai-chat` | mismatch | ui | design | copy button stores its timer handle in an attribute (handle values differ per page) |
| `/ai-chat` | mismatch | ui | design | simulated streaming reply: timer-driven chunk order |
| `/ai-chat` | mismatch | ui | design | simulated streaming reply: timer-driven chunk order |
| `/colors` | mismatch | runtime | design | frame timing: Home scrolls the listbox under the parked pointer, 1 of 6 runs (T31 fix rounds 1–2; not chunk loading) |
| `/carousel` | load | cdk | design | carousel engine starts on the first interaction on a resumed page, at mount in a client render |
| `/carousel` | mismatch | cdk | design | carousel engine state (in-view slides) follows its start |
| `/pro-forms` | load | ui | design | number roll entrance: a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/reanimate` | load | ui | design | number roll entrance: a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/forms` | load | ui | design | NumberStepper roll entrance (libs/ui/CLAUDE.md reanimate): a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/scroll-area` | load | cdk | design | ScrollArea viewport overflow: a mount-time browser effect runs on a client render only (a resumed page runs no component code until a change) |
| `/button-group` | mismatch | cdk | open | Menu close (Escape) on a resumed page returns focus to the previously focused button (bg-merge), a client render to the menu trigger (bg-more); first seen on HEAD a3e58f97 (T31 fix round 1) |
| `/sidebar-extensions` | mismatch | runtime | open | cold first click on a sidebar link counts as keyboard modality on the resumed page; first seen on HEAD a3e58f97 (T31 fix round 1) |
| `/action-bar-clear-grid` | recreated | cdk | open | grid rows re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/avatar-group` | recreated | ui | open | Avatar re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/visual/card` | mismatch | runtime | open | cold hover: hover state depends on whether the pointer entered before the hover handler's chunk loaded |
| `/data-grid` | recreated | ui | open | DataGrid rows re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/data-grid` | missing | ui | open | follows the DataGrid row re-creation (the bound element left the resumed page) |
| `/disclosure-group` | load | ui | open | DisclosureGroup Next button: server render misses the disabled state of the initial key |
| `/disclosure-group` | mismatch | ui | open | DisclosureGroup Previous/Next: the resumed page steps from a different expanded key |
| `/lightbox` | recreated | cdk | open | Lightbox slides re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/resume` | recreated | ui | open | surface span re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/selection-indicator` | recreated | cdk | open | SelectionIndicator re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/visual/segment` | recreated | cdk | open | SelectionIndicator re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/toggle-buttons` | recreated | ui | open | ToggleButtonGroup re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/toggle-buttons` | mismatch | ui | open | follows the ToggleButtonGroup re-creation (re-created buttons lose the press style) |
| `/visual/tag-group` | recreated | cdk | open | Tags re-created on the first change on a resumed page (component without its own region, root CLAUDE.md gotcha) |
| `/visual/tag-group` | missing | cdk | open | follows the Tag re-creation (the bound element left the resumed page) |

## 9. Risks

1. **Late captures + cells change evaluation order semantics.** Values are read at encode time, not at creation. A capture whose object is mutated between creation and encode already behaves this way (objects encode at segment end). Primitives / `let` now follow, which is the correct JS behaviour, but existing pages could observe a different value.
   - Streaming: a patch encodes later than the shell, so a captured `let` reassigned after the shell segment would differ per segment. Rule: a cell / thunk is read once, at its first encode (interned).
2. **Content hashes vs build determinism.** Hashes must use the post-`staticIcons` / i18n source (both targets identical) and exclude absolute paths. Twin ordinals must be stable under oxc codegen changes. A compiler upgrade that changes normalization re-ids everything. That is safe (fail-safe reload) but costs one reload per open tab per deploy.
3. **Escape analysis precision vs cost.** Wrapping too many local functions in `_rFn` adds per-render recorder work: an AsyncLocalStorage lookup + stamp per function, on cdk-heavy pages with thousands of closures. Too few leaves render errors. Needs the showcase A/B before landing C4. Fallback: wrap only when a site's capture graph reaches it, via a second fixpoint like today's captured-local rule.
4. **Context frames on every site.** Frame recording per handler / binding (`getOwner().ctx` read + intern) is on the hot recorder path of 1000-row pages. Must be one pointer compare against the region's frame in the common case. Risk of the +2% budget.
5. **Prototype restore without the constructor.** Restoring data classes skips constructor invariants (validation, derived caches, `WeakMap` registration, `EventTarget` subclasses). Misclassifying a resource holder as data gives subtly broken objects instead of an error. The compile-time eligibility check only sees initializers in the class body, not in base classes or packages. Mitigation (as landed, T23 fix 1): dev encode-time refusal of own state that would not resume as it is — stricter than an own-key-set check: symbol keys and non-enumerable fields (key-set differences), plus accessors, non-writable fields and frozen / sealed / non-extensible instances (shape); production encodes the enumerable data fields and decodes them writable, unfrozen (a dev/prod difference, documented in the `dev-and-production-differ` gotcha). Built-in bases are refused at runtime (native code + JS-implemented platform classes); JS-implemented library bases (Node `EventEmitter`, …) are caught at compile time: T24 registers only classes whose `extends` chain is module-local proven data classes.

Also noted:

- Group symbols and the two-phase class decode touch the decoder's BUSY cycle rule, which is a security-relevant invariant (SEC10, cyclic refs).
- Store path narrowing depends on literal paths. Libraries building paths dynamically fall back to the whole store (bytes, not correctness).

## 10. Decisions (user rulings 2026-10-09)

Implementation plan: [`docs/design/plans/2026-10-09-function-bridge.md`](../plans/2026-10-09-function-bridge.md).

- Q1: boot-time manifest hash check in addition to per-symbol checks? The cost is reloading pages whose used symbols are all still present.
  - **Ruling: per-symbol checks only.** No boot-time manifest check; `state.h` stays informational.
- Q2: are `let` cells shared between server render and the cell? A cell written by server code after render (an `Async` continuation) — encode at first encode or last? Proposed: first encode; dev warning on a later write.
  - **Ruling: first encode** (the cell entry is interned then); dev warning on a later server write.
- Q3: `reconstruct` naming and placement (`@rivetjs/runtime` vs `@rivetjs/reactivity`). Should it double as the client-only lazy value (`clientOnly` for values)?
  - **Ruling: `reconstruct` lives in `@rivetjs/runtime`, separate from `clientOnly`.**
- Q4: drop `createResume({ contexts })` once every context is identified? App singletons (an analytics client) would then need `reconstruct`.
  - **Ruling: drop it** once contexts are auto-identified; app singletons use `reconstruct` (breaking change allowed).
- Q5: should re-created recipe consts (today: `memo(...)` / `[() => …]` initializers re-run in the browser, side effects twice) become Reference values when every element is a Reference? That would be one less browser-side initializer run and a behaviour change for library factories.
  - **Ruling: yes.** A recipe const whose value holds only References (and data) encodes by value: no double side effects.
  - As landed (T18, 2026-10-12): `server-resume.ts` `special` — any `_rFn` value that is not live / forward / getter / group encodes by `plain` when it succeeds, else its recipe; failures memoised per recipe id (`recipeOnly`). `_rGroup` arrays stay recipes (members reference the array). Showcase state br −1.3 % … −8.5 %.
- Q6: dev-only capture identifier names: ship them in the dev manifest, or in the symbol module as a static?
  - **Ruling: dev manifest.**

## 11. Corpus mechanics

- One file, one Chromium session. Each case is compiled from a source string (server + DOM, resume mode), rendered with `resumableToString`, and served under `/k<i>/`. Library specifiers map to data URLs (server) and served modules (browser). A `domSource` builds chunks from another version (skew).
- Per case:
  - `today: …` test: pins status + message fragment (`note`). `todayDev` covers the dev / prod split.
  - `bridge: …` test: asserts `expect`. It is `test.fails` while today ≠ pass, so the suite is green and flips when fixed.
- `BRIDGE_CORPUS_LOG=1 npx vitest run --project runtime libs/runtime/tests/function-bridge-corpus-browser.test.ts --disableConsoleIntercept` prints the table.
- 51 cases × 2 projects = 204 tests (148 pass, 56 expected-fail). About 40 s per project on a loaded host.

## 12. As landed — rulings and deviations (T13–T31, 2026-10-12)

Each item is a coordinator ruling or an accepted deviation from the plan, by task. Detailed mechanics sit in the "As landed" notes above and in `libs/runtime/CLAUDE.md` / `libs/compiler/CLAUDE.md`.

- **T13 (C11 store literal paths):**
  - Module-level stores are never narrowed: they are scope references, not captures, so they ship whole.
  - A dynamic path has no diagnostic until RV2104 (T20).
  - Server-only references count in the path union. This over-ships and is safe.
  - Fix rounds: `at(…)` views are followed recursively; the runtime prune is memoized per (container, kept paths).
- **T14–T17 (context ids, frames, `createResume` contexts, Q4): deferred.** Ruling: wait for UI-IDENTITY, because T14 rewrites `resumableContext` across 169 ui/cdk files. Until then `resumableContext` and `createResume({ contexts })` stay the documented API.
- **T18 (Q5, recipe consts by value):**
  - `_rGroup` ids join `recipeOnly`: group member arrays keep their recipe, since the members encode as `{i}`.
  - The sticky process-wide `recipeOnly` memo is accepted and documented.
  - Behaviour change, ruled acceptable: a library factory that registers something in the browser by running there loses that registration. Browser-side work goes in `clientEffect`.
- **T19 (capture names):**
  - The router overlay's `symbolNote` matches ``capture `name` `` first and falls back to `capture #N`.
  - Ruling: the dev manifest ships user-facing names.
  - The Rust label/capture length assertion is moved to T20.
- **T20 (codes RV2103–RV2106): blocked on T16.** Not registered yet, so no RV2105 quick fix.
- **T23 (data class runtime):**
  - D-priv: no `FIELDS` / `RESTORE` accessor pair. True `#private` fields are refused, because a private brand exists only on objects the constructor ran on. The encoding is `{cls, a: [own fields]}`, with `rv` reserved for T25.
  - Built-in bases are refused (review M1).
  - Ruling M2: an unregistered subclass of a registered class is refused.
  - The decoder lives in the on-demand `resume-builtins` chunk (fix 1; `/dom-resume` +21 B br).
- **T24 (compiler data classes):**
  - Only module-local, proven data classes register. Importers never register imported classes; the defining module registers its own.
  - Only `.tsx` / `.jsx` imports are lifted. A relative `.ts` import stays RV2003 (`.ts` is not server-rewritten).
  - RV2102, not RV2101 (plan D7), covers: `#private` / `accessor` fields, decorators (ruling L2: refuse), field arrows reading `super` / `new.target`, non-data bases, and resource reads while constructing.
  - Ruling L1: an imported-call field initializer is a render error by design (documented).
  - Ruling M2: the RV2102 text named `reconstruct` only once T27 landed.
  - Known, not fixed: RV2001 for a browser global inside a class method body also blocks that class's registration (pre-existing).
- **T25 (`[serialize]` / `static [revive]` / `registerClass`):**
  - The entry is `{cls, a: [ref(data)], rv: 1}` (plan D6).
  - Ruling A: `registerClass` requires an `id` without `#`. The check also runs in production (review L1).
  - A `static [revive]` class lifts no field arrows (review M1).
  - The registry is a `Map`, not a `WeakMap`: the production resume-format bans `WeakMap` (dev-build test).
  - A cycle through a holder's data names the holder. Order-dependent cycles are documented (review L3).
- **T26 (`reconstruct` runtime):**
  - `reconstruct(f)` = `computed(f, { equals: false })` from `@rivetjs/runtime/dom` and `/server`. It is not `clientOnly`: a render that reads it runs the factory on the server, once per request.
  - Ruling L1: a module-level `reconstruct` is one instance per server process. This is documented; there is no per-request twin.
  - Refusal texts name the fixes. Production text: `function is not serializable: build it inside the component, or a library object with reconstruct(() => …)`. A user class gets `reconstruct(() => new X(…))` / `static [revive]`; a package class gets `registerClass`.
- **T27 (compiler `reconstruct` sites):**
  - Lowered as a `SiteKind::Computed` site with `{ equals: false }`.
  - A `reconstruct` reached through a value or alias is not compiled. Capturing it fails the render with "computed was not created in a resume-compiled component" plus a dev hint (review L1, landed with T28).
- **T28 (quick fix + RV2101 verdicts):**
  - `rivetReconstruct` covers RV2003 and RV2102; RV2105 joins with T20.
  - Reads are rewritten across the whole file, matched by symbol identity through a one-file checker (review F1).
  - `typeof x` in a type becomes `ReturnType<typeof x>`.
  - The fix is offered for `.tsx` / `.jsx` only.
  - RV2101 takes the compiler's class verdicts (check op `classes`), with no second heuristic.
- **T30 (test helper + skew e2e):**
  - `serializeAndRevive(make, …)` takes a function, not a value (ruling a): compiled sites (`_rFn`, `_rCell`, `_rStorePaths`, `reconstruct`) register only during a render; only capitalized (component-like) functions get `_rMod` stamps. `serializeValue(value)` covers plain values.
  - The value is captured by one client effect (`serializeAndRevive#value`), so refusals read "Cannot resume serializeAndRevive#value: …" (dev: "capture `value`"); the rest of the message is the page's.
  - The decode copies dom-resume's hooks minus the document (refs, routers, ErrorBoundary resets throw); the browser half (chunk evaluation + decode) uses its own `registerClass` registry, as a separate page would. Copy, not a shared `_decodeHooks` factory (T30 review F3): sharing would change the `/dom-resume` entry for a dev-only helper; a drift guard test (entry kinds + messages) and sync comments on both sides keep them aligned.
  - The value's effect is found by its symbol, not by position (T30 fix F1): effects `make()` registers (a component's `clientEffect`) come first.
  - Module ids are paths from the workspace root (nearest `package.json` with `workspaces`), not from the working directory (T30 fix F8).
  - `platform` (ruling): opt-in browser globals for the decode only (revivers, built-in entries), restored in `finally`; `reconstruct` factories and revived functions run later, outside it.
  - Resume modules come from the node register hook (`?rivet-resume=server|dom|chunk`); `rivetTest()` (Vite module runner) does not support it yet.
  - Skew e2e file `tests/resume-skew-browser.test.ts` (ruling b: the runtime project globs `tests/*.test.ts`).
- **T31 (resume fuzz):**
  - CSR = load `/`, trusted click on an injected link to the route (client navigation); resumed = load the route. Both contexts `reducedMotion: reduce`, same viewport, pointer parked at one spot.
  - Deviation from §6 ("a component run fails the test"): detection is DOM identity, not the runtime's dev re-run counter — "component run" = a server node the resumed page replaced while the client render kept it (elements stamped at load), on the production build users run. It misses a re-run that reuses the server nodes and nodes both renders replace (review T31 #5, accepted).
  - Attribute-only diffs are reported once, then that exact (attribute, resumed token, CSR token) triple is tolerated on that element (element key + driver-side rules; fix round 1, review #1 — first version ignored the attribute names for the rest of the run). A structural diff ends the DOM comparison; the route keeps stepping and checks errors / reloads (review #2). Each stopping finding is minimised by replaying the failing element's steps alone.
  - Pins match the finding's `diff` (differing tokens, the first differing line per page, replaced nodes, error text) — never the ±3 context lines — plus an optional `step` (review #2).
  - Cold state (review #3): the resumed page drops post-parse `modulepreload` links (preload queue, idle / `visible` preloads, hover-dwell prefetch) for the whole run — the link half of the hook the scheduler measurement uses (`libs/cdk/tests-components/scheduler-resume.test.ts`); each element's first interaction is cold every run. Holding `requestIdleCallback` too was tried and dropped: it stops idle boot / mount effects (masonry measure, table widths, announcers) and turns them into load differences a real page never shows. Removal after insertion is not proven to cancel a fetch Chrome already started; the evidence is the 3-run rule (3 reruns with identical findings before a `test.fails` pin, else a narrow design pin; guide "Fuzz").
  - CSR focus: `afterNavigation()` returns focus to the element focused before the router's h1 / `main` move (autofocus), else blurs (review #4).
  - Pin tests are skipped under `RIVET_FUZZ_STEPS` / `RIVET_FUZZ_SEED` (other plan); repro logs end with the rerun command (review #6, #7).
  - `design: true` pins = accepted (mount-time engine start) or non-deterministic (timer handles, simulated streaming, a cold hover seen in 1 of 2 runs) differences: filtered, no `test.fails` (a pin that does not reproduce every run would make CI flaky).
  - Budget: ui ≈ 15 min / cdk ≈ 10 min single-process → CI shards 3 per app (`RIVET_FUZZ_SHARD=i/3`).
