# Async coordination: Suspense + transitions (R-5)

Status: approved direction (gap analysis R-5, user 2026-10-04). DOM, server (ordered + streaming resumable) and resume ship now; compiler auto-thunk of `Suspense` children shipped (G24).

## Problem

- Several `Async` parts of one view each show their own fallback and pop in one by one.
- Changing state that reloads an `Async` replaces the visible content with the fallback; no way to keep the old UI and show a pending indicator.

## Comparison

| | Coordinated reveal | Keep old UI on change | Pending accessor | SSR |
|---|---|---|---|---|
| React 19 | `<Suspense>` (nested = separate) | `useTransition` / `startTransition` (concurrent render keeps old tree) | `isPending` | streams per boundary |
| Solid 1.x | `<Suspense>`, `<SuspenseList revealOrder tail>` | `useTransition` / `startTransition` | `isPending()` | streams per boundary |
| Solid 2 (RC) | `<Loading>` boundary; async memos | transitions implicit (entangled) | `isPending(fn)` | streams per boundary |
| Vue | `<Suspense>` (experimental) | — | — | awaits |
| Svelte 5 | `<svelte:boundary pending>` (await expressions) | old UI kept while `await` re-runs | `$effect.pending()` | awaits |
| Qwik | `useResource$` + `<Resource>` | — | — | streams |
| **Rivet** | `<Suspense>` over `Async` | `startTransition(fn, pending?)` over in-place `Async` reloads | `pending` signal (resumable) | ordered: awaits; streaming resumable: one segment per Suspense |

## API (`@rivetjs/runtime/dom`, server twins in `@rivetjs/runtime/server`)

- `Suspense({ fallback?, children })`
  - `children`: a thunk; the compiler thunks plain JSX children (G24). A prebuilt value passed as children still renders, uncoordinated.
  - Every `Async` generation below it whose `load` is pending registers with the nearest Suspense. While any is pending: content is kept mounted but detached (state, owners, scroll inside it survive), `fallback()` is shown. When none is pending, the fallback is disposed and the content moved back in one step (one flush, so all parts appear together).
  - Re-suspension (an `Async` below reloads, or a new one mounts) shows the fallback again (React/Solid semantics) unless inside a transition.
  - Nested Suspense: the inner one coordinates its own subtree; the outer one counts only Asyncs not under an inner one (nearest boundary). An inner fallback inside unrevealed outer content is invisible.
  - Failures: a rejected `Async` stops counting; without its own `error` it goes to the nearest `ErrorBoundary` (unchanged), which may be inside (renders its fallback inside the revealed content) or outside (replaces the Suspense).
- `startTransition(fn, pending?)` → `Promise<void>`
  - Runs `fn` in a `batch`; while it and its flush run, the transition is active.
  - An `Async` that re-runs in place (its `load` read a changed signal, or `hold`) during an active transition and already shows content: keeps that content mounted and live, shows no fallback, does not make a Suspense fall back; its new output is built detached and committed when every `Async` that joined the transition has settled (one batch: all changed parts swap together).
  - Transitions started while one is pending merge into it (Solid behavior); the promise resolves (and `pending` turns false) when the merged transition commits. A superseded generation leaves the transition.
  - `pending`: an optional `Signal<boolean>` the transition sets `true` at start and `false` on commit. A signal, not a returned function, so resumed handlers and bindings can capture it (functions are not serializable).
- `useTransition()` → `[pending: () => boolean, start: (fn) => Promise<void>]`: convenience for client-rendered components (`start` is a function: not capturable by resumed handlers; use `startTransition(fn, pendingSignal)` there).
- Server: `startTransition` runs `fn` (resolved promise); `useTransition()` → `[() => false, start]`; `Suspense` see below.

### Why in-place reloads only

- Rivet has no concurrent rendering: a binding that re-creates its subtree (`{card(id())}`) disposes the old one synchronously. Keeping it would need transition checks in `bindChild` (every app pays). In-place reload (`load` reads the signal; documented pattern since G18) keeps one boundary alive, so the old output can stay until the new one is ready.
- A fresh `Async` created during a transition (new region, new Show branch) behaves normally (fallback). React: new boundaries show their fallback in a transition too.

## Router interplay

- Route navigation is already a transition: the routes `Async` uses `hold` + `swap` (old page kept until the new route's data and code are ready), and `useNavigation()` exposes the pending state (`loading`, `shown` with delay / min duration). `useTransition` does not duplicate it: use `useNavigation()` for page-level pending UI, `startTransition` for in-page state changes.
- `hold` generations (router) never register with a Suspense (no fallback flip around a held route).
- A transition does not wait for navigations it starts (`navigate()` inside `fn` is tracked by `useNavigation()`).

## Server

- Ordered renders (`renderToString`, `renderToWriter`, `resumableToString`): Suspense renders its children; every `Async` below is awaited in place (as without Suspense); the fallback is never rendered.
- Streaming resumable renders (`renderResumable(..., { stream })`), consistent with `Async` streaming:
  - `Async`s below a Suspense never stream on their own (no per-child segments inside a boundary that reveals together).
  - The Suspense constructs its children synchronously (loads start at once). If no `Async` below reported a pending load, the content renders inline (no fallback, no markers).
  - Pending, with a `fallback`, in a claimable region site (same rule as `Async`: a child binding site, not a row/branch/claimed one): the Suspense claims the site (region `M`), writes `<!--rA[-->fallback<!--]-->`, and streams the whole content as one segment once all of it (nested Asyncs included) has rendered. The resume records its construction produced move into the segment's recorder view, so the segment's state patch carries them.
  - Otherwise (no fallback / not claimable): rendered in place, awaited.
  - Failure inside the segment: nearest server `ErrorBoundary` fallback segment, else continuation (status 2): the browser re-creates `M`, whose DOM `Suspense` loads in the browser.
  - Deadline / stream cut: continuation, as for `Async`.

## Resume

- Settled (ordered render, or segment written): static server DOM; nothing resumes until `M` (if any) is re-created, which runs the DOM `Suspense` fresh.
- Pending at boot (segment not yet arrived): the existing segment protocol (`a` entries, `$rA`, patch) — the Suspense is one boundary entry; its content swaps in when the segment arrives, or `M` re-creates on continuation.
- No `dom-resume` / loader changes.

## Zero cost (pay-per-use)

- Rule: an app importing none of `Suspense` / `startTransition` / `useTransition` pays ~0 B. Pattern: nullable hook slot checked by `Async`, installed by the feature module (like the router's leave guards).
- DOM:
  - `dom-suspense.ts`: `Suspense`, transitions, and the install `const on = _coordinate(coordinate, state)`; re-exported by `dom.ts`. `sideEffects: false` → unused module dropped by bundlers.
  - The install returns the module state (`on`: active / pending transition, Suspense token) that every export reads: Rolldown drops a bare top-level call in a `sideEffects: false` module even when the module is used. `tests/suspense-treeshake.test.ts` guards both directions.
  - `async-coordinator.ts`: the slot (`coordinator`); own module, so the install runs while `dom.ts` (re-exporter) still evaluates (no TDZ).
  - `Async` per generation: `p = coordinator ? coordinator(props, () => held) : props`; body reads `p.*`. One base change: fallback skip `!held` → `!(held && props.hold)` (same result uncoordinated: `held` only set with `hold`).
  - Coordinator returns adapted props: `hold: true` (output owned by the boundary, so a later transition can keep it), wrapped `load` (pending → Suspense registration, transition join, rejection release; thenable getter read once), wrapped `children` / `error` (run inside the transition; failure ends the generation's part and disposes the kept output, as the generation's own output was before), `fallback` (none when kept; empty when absent, so a reload clears the old output as before), `swap` (queue in the transition, release after apply).
  - Unbundled (dev server, tests): module always evaluated → coordinated path always on. Semantics equal by construction; covered by the full DOM / router suites running coordinated.
- Server:
  - `server-suspense.ts`: `Suspense`, `startTransition`, `useTransition`; install `const SUSPENSE = _onPending(mark, _SUSPENSE)` (returns the token Suspense provides: kept exactly when Suspense is used); re-exported by `server.ts`.
  - `server-suspense-slot.ts`: `_SUSPENSE` token, `_onSuspense` / `_claimSuspense` slot (shared with `server-resume`).
  - `Async`: `if (pendingHook) pendingHook()` on a pending load (only change).
  - Claim suppression inside a Suspense lives in `server-resume`'s `_onAsync` hook (`useContext(_SUSPENSE)`).
  - Kept out of `server.ts` / `server-async.ts` text on purpose: esbuild's minifier names by file-wide character frequency (dead code included), so new text there renames identifiers in the ssr-bench lane.
- Measured (min B vs pre-R-5): router/dom +14, router/server +18, ssr-bench `rivet-compiled.mjs` byte-identical; full entries runtime/dom +1950, runtime/server +569, server-resume +12. `builds.json` changes only in its `inputs` list (esbuild parses the re-exported `server-suspense*.ts`; zero output bytes).

## SuspenseList (considered, deferred)

- `revealOrder` (`forwards` / `backwards` / `together`) + `tail` over sibling Suspense boundaries: React never shipped it stable; Solid 2 drops it. `together` = one outer Suspense. `forwards` in streaming needs ordered segment writes in `Stream` (segments are written in completion order today). Deferred; open question.

## Compiler work (queued)

- Add `Suspense` to the thunked-children list (`compile.rs`, `thunked`: `["ErrorBoundary", "Show", "Match"]` → add `"Suspense"`, thunk in every module like `ErrorBoundary` — `Some("ErrorBoundary") | Some("Suspense") => true`), so `<Suspense fallback={…}><A/><B/></Suspense>` passes `children: () => [<A/>, <B/>]` on both targets. Oracle: no corpus case uses `Suspense` (expect 227/227 unchanged). Shipped in G24 (oracle 227/227).

## Tests

- DOM (happy-dom, compiled TSX): reveal together, state of revealed content kept on re-suspension, nested boundaries, failure → ErrorBoundary inside/outside, fallback disposal, eager-children warning path.
- Transitions: old content kept, no fallback, swap together, pending signal true→false, merge, superseded generation, fresh Async shows fallback, Suspense does not fall back in a transition.
- Server: ordered render awaits; streaming: inline when sync, one segment when pending, nested Async does not stream, failure → continuation.
- Browser (Chromium): streamed Suspense segment swaps in a resumed page, handler inside streamed content works.
