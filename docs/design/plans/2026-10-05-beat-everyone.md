# Beat everyone — optimization plan (2026-10-05)

- Goal (user): Rivet beats Solid, Svelte, React and Razor in **all** scenarios. Competitor numbers are stored (apps/dom-bench/competitors.json, krausest/published.json, ssr/resume evidence); only Rivet runs. API changes allowed, any language allowed.
- Work on `perf/ssr-beat-razor` in the main checkout; UI work waits until done.
- Scoreboard: `node apps/dom-bench/scoreboard.ts` → docs/benchmarks/perf-scoreboard.md. Baseline (ff974ee-equivalent, default build): **3 WIN / 29 LOSE**.

## Baseline gaps (default build)
| Scenario | Rivet | Best competitor |
|---|---|---|
| dom 5k mount | 454 ms | Solid 79 |
| dom 5k update100 / heap | 46.6 ms / 76.9 MiB | Solid 2 21 / Solid 1 31.2 |
| dom nodes 5k | 890k (440k comments) | 450k |
| krausest CPU geomean (× vanilla) | 1.47 | Solid 1.08 |
| krausest swap / clear | 5.68 / 2.10 | Solid 1.14 / Svelte 1.20 |
| krausest run-memory | 2.50 | Solid 1.43 |
| bundle (krausest brotli) | 7.28 kB | Solid 4.50 |
| resume slow click / filter | 5.1 / 19.2 ms | Solid 3.8 / 11.2 |
| ssr p99 100 rows c1 | 1.2 ms | Razor 0.7 |

## Root causes (from compiled output + runtime read)
- Every `template()` = new root owner + frozen range object + WeakMap entry + onCleanup closure + 2 boundary comments.
- Every `component()` = `wrap()`: another root, a DocumentFragment and 2 more comments.
- Every dynamic child/text = 2 comment markers + effect; **static expressions are bound as effects** (`{`Field ${index % 10}`}`, `data-field={index}`): 4 effects per field where Solid has 1.
- Slots resolved by path arrays per clone; Solid walks `firstChild/nextSibling` in generated code.
- One listener + closure + cleanup per button; Solid delegates (`$$click`).
- Reactive `Node` has ~22 fields; Solid's computation ~12.
- For: no prefix/suffix trim or LIS (swap 5.7×), no fast clear.

## Design: DOM v2 (client-created DOM; production, non-resume target)
- **Static analysis (compiler)**: an expression is dynamic iff it contains a call, member access, `new`, tagged template, or `await`, outside nested functions (dom-expressions rule). Literals fold into template HTML. Identifier-only values set once, with a runtime `typeof v === "function"` check falling back to a reactive binding.
- **Templates**: hoisted `_tpl(html)` → cached `<template>` content; clone the single root (or fragment) and walk with generated `firstChild/nextSibling` chains. Return the Node. No owner, no range, no comments of its own.
- **Components**: plain untracked call `_c(Comp, props)` under the current owner. No wrap, no boundary.
- **Text**: sole dynamic text child → template holds a text placeholder, effect writes `.data`. Mixed content → one `<!>` anchor + insert.
- **Children**: `_insert(parent, value | accessor, marker | null)` — dom-expressions insert/reconcile (text fast path, arrays with `reconcileArrays`, node/range values). Marker only when there are later static siblings.
- **Events**: delegated by default for bubbling types: handler on node (`el.$$click`), one listener per type per document, `stopPropagation`/`currentTarget` emulated; non-bubbling types direct.
- **Ownership contract (API change)**: DOM created by a template is owned by the nearest reactive scope (insert effect / mount root / For row). Imperative DOM mutation inside compiled output is not tracked (Solid semantics). Documented in docs/superpowers/specs/2026-10-05-dom-v2.md.
- Dev and resume compilation keep the v1 ABI (HMR component boundaries, devtools ranges, server adoption) until v2 covers them; v1 functions stay exported and tree-shake away from v2 apps.

## Phases (each: tests for new contract → implement → A/B under bench lock → scoreboard → commit)
1. Runtime v2 primitives in dom.ts: `_tpl`, `_insert`, `_text`, `_attr`, `_c`, `_delegate` + tests (TS only).
2. Compiler v2 lowering for DOM production target (Rust): static analysis, walk codegen, v2 ABI; corpus re-record (intended).
3. For/Show/Switch on v2 insert: mapArray + reconcileArrays (prefix/suffix, LIS, fast clear/append). Reference: branch perf-list-reconcile.
4. Reactivity slimming: smaller Node, fewer allocations per effect (reference: branch perf-reactivity-heap be94b26), renderEffect fast path for bindings.
5. Bundle bytes: v2 ABI is smaller; check krausest brotli ≤ 4.5 kB.
6. Resume: click/filter latency (reference: perf-resume-click af11029), HTML/state size (perf-html-state-size 9d94305).
7. SSR tail: p99 at 100 rows c1 vs Razor (GC/semi-space, writer).
8. Dev + resume targets onto v2 where it wins; delete v1 paths no longer used.

## Progress
- Phase 1 (runtime v2) + part of Phase 4 done; hand-lowered lane `rivet-v2` (apps/dom-bench/adapters/rivet-v2.js), same session vs Solid stable:

| dom-bench | v1 | v2 | Solid stable |
|---|---|---|---|
| mount 1k / 5k ms | 82 / 437 | 15.7 / 78.1 | 17.2 / 79.9 |
| update100 1k / 5k ms | 8.4 / 44.4 | 3.5 / 20.1 | 5.4 / 25.6 |
| heap 5k MiB | 82.2 | 26.9 | 31.2 |
| nodes 5k | 890k | 450k | 450k |

- Findings: inert-template clones beat `importNode`'d ones (5k mount 118 → 86 ms); reading `Text.data` back per update costs ~30%; a per-event `currentTarget` getter closure is pinned by V8 map descriptors and leaks the event path (use a data property).
- Reactivity: signals = bound read + shared `set`/`update` (methods: call on the signal); graph links inline while single (no 4 arrays per binding); Node lost `token/context` (→ `ctx`), `diverged` (→ `cursor -1`), `flushRuns` (rare-path Map); binding probes on parallel stacks.
- Phase 2 (compiler v2, opt-in `domV2`) + Phase 3 (`_for`) done. Compiled `rivet` lane = hand-lowered lane (5k mount 79.8 vs 80.1 ms). `mount` now runs the v2 root path (no boundary markers of its own): v1 `mount` cost 6 ms at 5k.
- v2 ABI after memory work: one closure per dynamic binding (`_fx(() => _cls(el, expr))`, `_fx(() => _t(el, expr))`); `_t` keeps its state on the element (`$$t`), scalars write text, first node/array value switches to insertion. `_text` / `_attr` / `_setAttrEffect` removed.
- `_for`: rows are `_rootIn` roots (no disposer closure/result object), item signal created on first tracked read, bound item accessor, mapArray-style prefix/suffix by identity (Map only for the middle), dynamic rows via `_insert` between two empty Text anchors (no v1 ranges → v1 `bindChild`/`wrap`/`move` tree-shake). Reconcile = udomdiff + whole-parent replace fast path (LIS dropped).
- Reactivity: `flushId` → epoch since flush start; `Owner.last` dropped (children newest first, disposal order unchanged); `ctx` added only on provider owners.
- Findings: `String(number)` fills V8's number-string cache (64 KB at 1k rows) — hand numbers to the DOM; `class=""` on fresh rows costs style work (empty class now removes).
- krausest (local, Rivet only, vs stored ratios): memory 21 1.07 / 22 1.33 / 25 1.18 — all WIN (Solid 1.25 / 1.43 / 1.33). Heap diff vs vanilla 838 → ~700 B/row. Size 6.16 kB brotli — still LOSE (Solid 4.50). CPU weighted geomean 1.02 × vanilla (Solid 1.08, Svelte 1.13): WIN; near-noise losses run1k 1.06, remove-one 1.16, create-after 1.07.

## Queued after the goal (user requests)
- `Link` active state, both APIs: declarative `active="cls"` + `exact` (SSR class + `aria-current="page"`, router toggles `data-rivet-active-class` links after each navigation, no component code) and a render-prop escape hatch `class={({ isActive }) => …}`. Prefix match by path segment; explicit `aria-current` wins.

## Paused 2026-10-05 (laptop sleep)
- Uncommitted, unverified: loader `find` memo + prefetch-once + skip evaluate when loaded (resume-loader.ts/.min.ts); resume-browser.test.ts expectations for adopted rows without markers (a169969 shipped with those 2 tests failing; fix is this update).
- Next: full gates (check `Failed tasks` in log, not only exit code), commit; then size: tree-shake computed via ComputedNode methods (no semantic change). Size options 2/3 (dev-only guards, trade margins) await user.
