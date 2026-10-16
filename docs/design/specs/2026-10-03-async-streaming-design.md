# Async streaming + continuation (resume)

Status: approved 2026-10-03. Implements the resumability spec item "`lazyComponent` / `Async`: pending ones continue from serialized pending state".

## API

- `renderResumable(factory, writer, { manifest, stream: { deadline? } })` — opt-in per render. `deadline` (ms from render start) has no default: without it, segments wait until they settle or the request aborts.
- An `Async` streams only with a `fallback` and only when its `load` returns a pending promise. `lazyComponent(importer, select, { fallback })` passes it through.
- `resumableToString` and plain `renderToWriter` / `renderToString` are unchanged (zero-cost gate: ssr-bench HTML byte-identical, Razor comparison rerun).

## Server

- Region claim: at `Async()` call time the recorder claims the enclosing region-site scope `M` (the `<Async>` / `<LazyThing>` child site, or the component site that renders it). A claimed scope is recorded as a region even without signal reads, so the browser can re-create it through its DOM symbol. Row scopes, missing scopes and already-claimed scopes do not stream (awaited as today).
- Pending load: write `<!--rA[-->fallback<!--]-->` (A = boundary marker id), fallback recorded under logical scope `F` (parent M); register segment `{A, F, M}`; keep rendering the shell.
- Shell end: state + loader as today, plus state `a: [[A, F, M, 0]…]` and the stream add-on script.
- Segment: resolved subtree rendered to a buffer under its own recorder view (own record lists, shared id counter / encoder), items attributed to `M`. Written in completion order, after its parent segment:
  `<template data-a="A">…</template><script type="rivet/state" data-patch="A">delta</script><script>$rA(A)</script>`.
- Delta: incremental encoding against one persistent encoder: `t0` + new table entries, new chunks, symbols, `e`/`m`/`b`/`fx`/`ce`, lazy map, sibling groups, interaction chunks, new event types, preload schedule, boot flag, `a` status.
- Load failure without `error`, deadline, or request abort: status 2 (continuation) → the browser re-creates `M` (its DOM `Async` runs `load`). Nested segments of a continued segment are dropped.
- Async scope disposal is deferred until its segment is written or abandoned.

## Client

- Row-template expansion no longer appends to `t` (server table indices must stay aligned with patches): row item / index captures become const refs `≤ -10` into `state.k`; the runtime resolves them.
- Stream add-on (inline, only on pages with pending boundaries) defines `$rA(A)`:
  - region `M` not dead → swap template content into marker `A`; else drop the DOM;
  - merge the delta into parsed state (or queue it until the loader parses);
  - runtime started → `rt.patch(delta)` (stubs, effects, client events, triggers, marker cache reset);
  - new event types → loader listeners; delta preload schedule → loader queue; status 2 or boot flag → boot.
- `DOMContentLoaded` with boundaries still pending (stream cut) → status 2 for each.
- Runtime: `a` entries set `F → M` parents; status 1 kills `F`; status 2 activates `M` at `load`.

## Tests

- server-resume: shell/segment order, patch `t0` alignment, nested segments after parent, failure → continuation, deadline, abort, non-streaming output unchanged.
- browser: click inside streamed content before and after runtime start; continuation renders through client `load`; segment for a re-created region dropped; cut stream continues.
- zero-cost: ssr-bench byte-identical, Razor recheck.
