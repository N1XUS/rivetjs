# Stores (R-4)

Status: approved direction (gap analysis R-4, user 2026-10-04). Runtime API ships now; compiled property syntax queued.

## Problem

- Nested state (`{ user: { name }, todos: [...] }`) needs one hand-made signal per field, or one signal for the whole object (every reader re-runs on any change).
- Constraints (gap analysis §4): no proxies (resume must serialize identity; proxies cost bytes everywhere and hide reads from the compiler); zero cost when unused; resume-serializable.

## Comparison

| | Deep state | Reads | Writes | Resume |
|---|---|---|---|---|
| Solid `createStore` | proxy, lazy signal per read property | `store.a.b` | `setStore("a", "b", v)`, `produce`, `reconcile` | n/a (hydration re-runs) |
| Svelte 5 `$state` | compiled deep proxy | `obj.a.b` | `obj.a.b = v` | n/a |
| Vue `reactive` | proxy | `obj.a.b` | assignment | n/a |
| Qwik `useStore` | proxy, serialized with subscriptions | `store.a.b` | assignment | yes (big runtime) |
| Angular signals | none (manual nested signals / `computed`) | — | — | — |
| **Rivet** | plain node tree, lazy path signals | `read(store, "a.b")` | `write(store, "a.b", v)`, `produce`, `reconcile` | plain objects of signals: the existing table |

## Decisions

- Entry `@rivetjs/reactivity/store` (separate export, `sideEffects: false`): `createStore`, `read`, `write`, `at`, `produce`, `reconcile`, types `Store`, `StoreView`, `StorePath`, `StoreValue`. Nothing else changes: zero bytes for apps that do not import it.
- **Paths are dotted strings** (`"todos.0.done"`), typed like `@rivetjs/forms` `FieldPath`/`PathValue` (same shape, depth 8). Rationale: one path syntax across Rivet (forms field names, issue maps), compiler-friendly literals, cheap cache key. Keys containing `.` are not addressable (use a Map value or an id-keyed object without dots).
- **Store = plain node tree**: `{ v: Signal<value>, c?: { [segment]: node } }`. The root signal holds the whole (immutable) data; a child node exists only once its path was read (`read`/`at`/a write that passes through it), holding the value at that path.
  - Reading subscribes to the read path's signal only (`read(s, "user.name")` re-runs on name changes, not on `user.email`).
  - Values are structurally shared: child node values are the same objects as inside the root value.
- **Writes are copy-on-write**: `write(s, "todos.0.done", true)` copies the containers along the path (array `slice`, object spread), then in one `batch`: sets each existing node along the path (ancestors' readers re-run: their value changed), then refreshes existing nodes under the target, descending only where `Object.is` differs. Untouched siblings are never visited. Equal write → no-op.
  - A function argument is an updater (`write(s, "count", (n) => n + 1)`); store values should not be functions (not serializable anyway).
  - Missing containers on the path are created (`{}`; `[]` when the next segment is an index).
  - Values returned by `read` are treated as read-only (mutating them bypasses notification; documented).
- `produce(mutate)` → updater: clones the previous value (`structuredClone`), runs `mutate(draft)`, then reconciles against the previous value so unchanged subtrees keep identity (minimal notifications). `reconcile(next)` → updater: same structural merge for replacing data from a fetch. (2026-10-06: `produce` is now copy-on-write drafts — see `docs/guides/stores.md`.)
- `at(store, path)` → `StoreView` `{ s, p }` (same shape as forms' `FormView`): a typed, serializable cursor; `read`/`write`/`at` accept stores or views. For list rows: `at(todos, `items.${i}`)`.
- **Resume**: the store and views are plain objects of signals → the existing table serializes them; each read path is one signal entry pointing at a shared data entry, so per-path state is serialized without duplicating data. Bindings that read a path record that path's signal, so the browser re-runs exactly them. No `dom-resume`/`server-resume` changes (0 B for resumable apps).
- Node lookup cache: a module `WeakMap<root, Map<path, node>>` (never serialized; rebuilt lazily after resume).
- DevTools: development façade `store-dev.ts` (export condition `development`) emits `store.create { store, owner, tree }`; `@rivetjs/reactivity/debug` gains `_debugStore(store)` (tree of `{ path, value, signal, observers, children }`). Production resolution never reaches either. Minimal on purpose: the DevTools UI rework (branch `feat-devtools-edit-context`) integrates it later (store panel listing `store.create` events, tree from `_debugStore`).

## Not now

- Node pruning (deferred): path nodes are created on first read and live as long as the store (a removed key / shrunk array keeps its node, value `undefined`). Fine for bounded shapes; long-lived stores over churning keys grow. Later: drop nodes without observers on write, or a `prune(store, path)`. (2026-10-06: done for removed keys on refresh — `docs/guides/stores.md`.)

- `createSelector` (O(1) selection): useful, separate small addition (closure-based, so not resume-capturable as is).
- Forms: `FormStore.v` (per-path value signals, flat dotted keys) could become a `Store` later (same path syntax); not refactored (note only).

## Compiler work (queued)

- Goal: `const s = createStore({...})` in a component module; `s.user.name` (read, inside JSX/bindings/computed/effects) compiles to `read(s, "user.name")`, `s.todos[i].done` to `read(s, "todos." + i + ".done")` (via a `__rivetStorePath` helper joining segments); assignments `s.user.name = v` → `write(s, "user.name", v)`; `s.count++` / `+=` → updater writes.
- Detection: identifiers bound (const) to a call of `createStore` imported from `@rivetjs/reactivity/store` (named import, local alias allowed), and `at(...)` results; member chains rooted at them; computed members with any expression key. Stop at the first call (`s.todos.map(...)` → `read(s, "todos").map(...)`).
- No change to resume capture analysis: the captured value is still the store object.
- Diagnostics: passing `s.user` (a member chain) where a store is expected → hint to use `at(s, "user")`; mutation through a returned value (`read(...).x = 1`) unchanged (runtime cannot see it; doc).
- Types: the language service would type `s.user.name` as the value type (a typed `Store<T>` facade type, `StoreProxy<T>`), only in compiled modules.

## Tests

- Unit: lazy node creation, fine-grained notification (sibling paths don't re-run), ancestor/descendant notifications, array updates, updater/equal writes, missing containers, views, `produce`/`reconcile` identity preservation, batch (one flush per write), computed write rejection, type tests.
- Resume: a resumable component capturing a store, server state contains only read paths, browser click writes a path and updates only its binding.
- Bench: `libs/reactivity/bench/store.ts` (rivet vs `@solidjs/signals` store): create + read 1k rows, update one leaf, update all leaves.
