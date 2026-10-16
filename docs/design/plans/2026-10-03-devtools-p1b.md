# DevTools P1b Implementation Plan: value inspector + signal names

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Checkbox (`- [ ]`) tracking.

**Goal:** (1) expandable value tree everywhere the panel previews values (arrays, plain objects, Map, Set, class instances with prototype getters listed not invoked, lazy children over the protocol, depth/size caps, cycles, built-ins, long strings, leaf edit at a path); (2) signal / computed names from source bindings, scoped by component (`Layout › count`, collisions `count#2`, unnamed `signal #id`), one display format in every panel.

**Architecture:**
- Names: dev-server-only JS transform of the compiled client module (`@rivetjs/devtools/server` `nameSignals`), called from `rivet()`'s transform when DevTools is on (serve, client). Wraps `signal(…)` / `computed(…)` calls imported from `@rivetjs/*` as `__rivetName(signal(…), "count")`; a hoisted helper appended to the module emits `name { value, name }` to the hook. Same-line edits; the compiler's source map gets its generated columns shifted (no line changes), so `hotModule` (line-based) and stacks keep working. Rust compiler, non-dev compile, builds untouched.
- Agent: `name` event → label per graph ref (getter for signals, node for computeds) with a creation sequence; scope = nearest visible component; collisions numbered per scope in creation order. `SignalInfo` / `NodeInfo` / `GraphNode` gain `name?`, `scope?`; `displayName()` in `protocol.ts` is the one formatter.
- Values: `value.inspect { h, offset?, ancestors? }` → `{ entries, total }` pages of 100; ancestors (handles) → `[circular]`; class instances add prototype accessors (`proto: true`, never invoked); typed arrays / ArrayBuffer / DataView / text nodes previews; long strings get a handle, `value.text { h }` returns up to 64 KiB. `signal.setPath { id, path, json }`: JSON-safe signals, immutable update of a leaf, through `.set`.
- UI: `ValueTree` (lazy rows, expansion kept by path across writes, depth cap 32, "N more" paging), `NodeLabel`; replaces `Value` in signals, computeds, graph, context, props.

**Spec:** [devtools design](../specs/2026-10-03-devtools-design.md) (P4 "compiler dev labels" pulled forward as a JS dev transform; spec preview `cyc`/`trunc` kinds reused).

## Constraints
- Production / development builds and `compile()` output byte-identical: transform runs only in `serve && client && tools`.
- `libs/compiler/vite.ts`: ≤ 5 changed lines (shared with parallel agents). No router plugin change.
- Agent never invokes getters; proxy trap errors contained; previews read intrinsic getters only (Map/Set size, typed array length via `%TypedArray%.prototype`).
- Gates (agent-common.md) before finishing.

## Tasks
- [x] 1. `preview.ts`: `inspect()` (paging, ancestors cycles, prototype accessors), typed arrays / buffers / text nodes, string handles, `setPath()`; tests in `tests/preview.test.ts`.
- [x] 2. `names.ts`: `nameSignals(code, map)` (parseAst, import tracking, binding / property / class field / assignment names, map column shift); tests `tests/names.test.ts` (incl. map round trip, no-op without rivet imports).
- [x] 3. `model.ts` + `agent/index.ts` + `protocol.ts`: `name` event, scoped labels, collisions, new requests; tests in `tests/model.test.ts`.
- [x] 4. `server.ts` re-export; `vite.ts` call (serve client only).
- [x] 5. UI: `ValueTree`, `NodeLabel`, panels switched; styles.
- [x] 6. E2E: fixture copy gains a nested value signal + computed + collision; asserts names in Components / Signals / graph, expansion (Map, Set, class getter listed, circular, long string), leaf edit at path.
- [x] 7. Docs (`docs/guides/devtools.md`), spec Implementation notes; gates.
