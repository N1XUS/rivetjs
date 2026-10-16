# Stores

`@rivetjs/reactivity/store` (experimental): nested state with one signal per read path. Design: [stores spec](../design/specs/2026-10-04-stores-design.md). Guide: `apps/docs/content/guides/state/stores.md`.

## API

- `createStore(initial)` → `Store<T>`: plain node `{ v: Signal<T>, c?: { [segment]: node } }`; `initial` treated as immutable.
- `read(store)` / `read(store, "a.b.0")`: tracked read of one path; creates the path's node (and ancestors) on first read.
- `write(store, value | updater)` / `write(store, path, value | updater)`: copy-on-write along the path (missing containers created: `[]` before an index segment, else `{}`), then one `batch`: ancestors + target set, existing nodes under the target refreshed where `Object.is` differs. Equal write: no-op.
- `at(store, path)` → `StoreView<V>` `{ s, p }` (like forms' `FormView`); `read`/`write`/`at` accept views.
- `produce(mutate)` → updater: `mutate` gets a copy-on-write draft (Proxy over plain objects / arrays). First write to a container shallow-copies it and its ancestors; untouched paths are never copied or visited. Written values are structurally merged with the previous ones (equal subtrees keep identity); nothing changed → previous value returned (write is a no-op). Draft revoked after `mutate` (leaked draft throws).
  - Plain objects (`Object.prototype` / null proto) and arrays: drafted. Map / Set / Date reached through the draft: copied on access (mutate freely; that path counts as changed). Other class instances, functions: values kept by identity — replace, don't mutate in place. Non-plain root: Map / Set / Date mutated as a copy, else passed through.
  - 100k rows, flip one leaf: 88.6 → 0.28 ms/op (was `structuredClone` of the whole store); path `write` 0.03–0.06 ms/op.
- `reconcile(next)` → updater: `structuredClone(next)` + structural merge; unchanged subtrees keep identity.
- Types: `StorePath<T>` / `StoreValue<T, P>` (same shape as forms' `FieldPath` / `PathValue`, depth 8).
- Rejected segments: empty, `__proto__`, `constructor`, `prototype`.

## Behavior

- Readers of `user.name` re-run only when that value changes; readers of `user` on any change below it; readers of `todos` on any row change.
- Data is structurally shared: node values are the objects inside the root value.
- Node lookup: per-root `Map<path, node>` cache (module `WeakMap`, never serialized).
- Pruning: a write's refresh drops nodes of removed keys (key absent in the new container) when no reader observes the node or anything below it, plus their cache entries; a later read re-creates them from the data. Observed nodes stay (set to `undefined`, readers see the key return). Collector reads (`_trackReads`, server resume recording) are not observers.

## Resume

- Store and views: plain objects of signals → ordinary table entries. Root signal holds the data once; each read path adds one `{ v }` node entry whose signal value points at the shared data entry.
- Bindings that read a path record that path's signal → the browser re-runs exactly them after a resumed `write`.
- Narrowed captures (Function Bridge T12, runtime; compiler C11 = T13 emits the marks): `_rStorePaths(store, paths)` (server-resume) marks a captured store for this render with the literal paths its captured code reads / writes; every mark in one render adds to the store's paths (two capturing components: union). A marked store whose server reads were all by path (`_storePaths(store)` ≠ `null`) encodes `{k:"store", a:[root signal, nodes]}`: the root signal and every node signal hold only the containers along (server-read paths ∪ literal paths), leaf values by identity; the browser rebuilds `{ ...nodes, v }`. A whole read (`read(store)`) since creation, an unmarked store or a view ships the whole data as before. A path neither read on the server nor named in captured code reads `undefined` in the browser (that is the contract C11 must keep: every path a captured closure can reach is literal or the store stays unmarked); dev builds ship the kept paths too and warn on such a read (`Rivet resume: store path "…" was not shipped …`, once per store and path, with `in` / `fix:` / `docs:` lines; a browser write marks its path present).
- Compiler marks (Function Bridge C11 / T13, `libs/compiler/rust/src/resume/stores.rs`, server target only): a `const s = createStore(…)` (`createStore` imported from `@rivetjs/reactivity/store`, any local name) that a resumed site captures — directly or through a captured `const v = at(s, …)` view (views of views too) — and whose EVERY reference in the module is the first argument of `read(s, path)` / `write(s, path, next)` / `at(s, path)` (same import) with a literal path (string or substitution-free template; parentheses / TS casts around the argument looked through; namespace calls `st.read(s, …)` resolve) → `const s = _rStorePaths(createStore(…), [paths])` (sorted, deduped). Views (fix round 1): `at(s, "p")` must be the first argument of `read` / `write` / `at` (inline) or the initializer of a `const v` whose every reference is, recursively: `read(v, "q")` / `write(v, "q", next)` → `p.q`, `at(v, "q")` → view at `p.q`, `read(v)` / `write(v, next)` / a dynamic or `""` path → `p` (subtree); `at(v, dynamic)` → `p`, and everything below that view is clamped to `p` (fix round 2; its uses are still checked, `w.s` → whole; corpus `store-paths-view-dynamic-at`). Any other reference of the store OR of a view keeps the whole store, no wrapper: `read(s)` / `write(s, next)`, a dynamic root path, passed / returned / aliased / spread / read as a member (`s.v`, `v.s`, `v.p`) / given as a JSX prop, or a `let` binding (a view holds its root store, `StoreView.s`; corpus `store-paths-view-escape`). The language service will warn on the dynamic case (RV2104, plan T20). Never member-narrowed (T11): the capture is the whole store, its signals carry the pruned values. DOM output and symbols unchanged.
- Not narrowed: a store encoded while streamed segments are pending (the shell of a streaming render; a later segment could mark or read more paths of the interned entry — same rule as `j` entries), a store read whole since creation — for a module-level store that is any request, ever (the flag sticks to the store object).
- Pruning builds new containers along the kept paths (a kept ancestor drops deeper paths first): the store's data is never written, frozen data encodes. One pruned copy per original container and relative path set per entry (T13): the root value and a node value share it, so browser identity holds (`read(s).user === read(s, "user")`); object keys keep the data's order; `__proto__` / `constructor` / `prototype` path segments ship nothing.
- `_storePaths(store)` (reactivity ABI): cache keys of the nodes reads created (ancestors of a read path not listed), `null` after a whole read or for a view; the whole-read flag is a symbol key on the root (`WHOLE`, never encoded; ~+0.6 ns per whole read, a WeakSet measured +3.5 ns / +60 ns per new store).
- Unmarked pages: runtime unchanged in behaviour; the store hook in `special` is installed by the first `_rStorePaths` call (folded away without it: the ssr-bench server lane is byte-identical; the browser decoder gains the `store` branch).

## Development

- `development` condition: `store-dev.ts` emits `store.create { store, owner, tree }` on the devtools hook (level ≥ 1).
- `@rivetjs/reactivity/debug` `_debugStore(store)`: `{ path, value, signal, observers, children }` tree of read paths.
- DevTools UI integration pending (branch `feat-devtools-edit-context`).

## Bench

- `node --expose-gc libs/reactivity/bench/store.ts [--samples N] [--json]`: 1,000 rows, effect per row `done`; vs `@solidjs/signals` `createStore`.
- 2026-10-04 (3 samples, shared machine): setup 1.16 / 1.42 ms, 1,000 single toggles 1.77 / 2.74 ms, 20 full toggles 7.5 / 18.4 ms (rivet / solid); same effect runs.

## Not yet

- Compiled property syntax (`s.user.name` → `read(s, "user.name")`): queued compiler work (spec).
- Forms' `FormStore.v` could reuse a store (same dotted paths); not refactored.
- Pruning of observed-then-released nodes (pruned only on the next write that touches their parent).
