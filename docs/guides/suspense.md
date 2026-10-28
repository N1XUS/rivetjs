# Suspense + transitions

`@rivetjs/runtime/dom` (server twins in `@rivetjs/runtime/server`), experimental. Design: [async coordination spec](../design/specs/2026-10-04-async-coordination-design.md). Guide: `apps/docs/content/guides/components/suspense.md`.

## API

- `Suspense({ fallback?, children })`: plain JSX children compiled into a thunk (both targets, every module, like `ErrorBoundary`); explicit thunks unchanged; a prebuilt value (`{parts}`) is thunked but already built → uncoordinated.
- `startTransition(fn, pending?: Signal<boolean>)` → `Promise<void>` (resolves after commit).
- `useTransition()` → `[pending, start]` (client-rendered only: `start` not capturable by resumed handlers).

## DOM

- Async generation with a pending load registers with the nearest Suspense (context `SUSPENSE`), unless it keeps shown output (hold / transition). Release on content apply, failure, supersede, unmount.
- Suspense: count signal; pending → content moved into a detached fragment (owners live), fallback shown under the Suspense owner; 0 → fallback disposed, content moved back in one flush. Re-suspension shows the fallback again; registrations made inside a transition are ignored once revealed.
- Async output is now always owned by the boundary (`outer`), tracked as `held`; a generation's cleanup disposes it unless `hold` or a transition is active (same visible behavior as before for non-hold).
- Transition: `n` members (+1 while `startTransition` runs `batch(fn)` and its flush), queue of commits, pending signals, resolvers. A generation starting while active (not `hold`) joins: keeps `held` (no fallback), builds its content detached at resolution with the transition active (nested fresh Asyncs join too), queues the apply; superseded/unmounted → leaves. `n` = 0 → all applies in one `batch`, pending signals `false`, promises resolve. Starts during a pending transition merge into it.

## Server

- Ordered renders: children in place, Asyncs below awaited, no fallback.
- Server `Async` inside a Suspense: never claims its own stream segment; sets `p` when its load is pending.
- Resumable renders (derived model): not streaming (`derivedToString`), `Suspense` is awaited in place. Streaming (`renderDerived` with `stream`, DERIVED-GAPS 02): a Suspense with a fallback constructed in the shell (not inside an `ErrorBoundary`'s content, a shell cache render or a streamed `Async` segment) whose parts are pending once its content is constructed writes its fallback plainly between `<!--sN-->` / `<!--/s-->`; its content renders after the shell in document order (inner after the content holding it) as `<template data-s="N">` + `$rS(N)` (`server-derived.ts` `SUSPENSE_SWAP`, once), which replaces the fallback and drops the markers; the boundaries tail follows the last content, so the browser adopts the in-place page (no hole, no wire change). An `Async` inside a Suspense never streams on its own. `stream.deadline` (from the first claim): unwritten contents stay fallbacks, the unit holding one renders in the browser. A boundary whose probe run suspends renders in the browser on its first adopt (dev warning). Streamed `Async` holes: `docs/guides/resumability.md` "Mechanics".

## Resume

- Awaited in place, or streamed before the tail (above), on resumable renders; `pending` signals ship like any keyed signal. Tests: `libs/runtime/tests/derived-stream-browser.test.ts` (DERIVED-GAPS 02 block).

## Router

- Navigation = existing transition (`hold` + `swap` routes Async, `useNavigation()`); hold generations never register with a Suspense nor join a transition.

## Limits

- Transitions keep output only for in-place reloads (`load` reads the signal). Re-created subtrees (`{card(id())}`, new Show branch) show their fallback.
- Resumed page: a boundary whose own Suspense content waits for a load renders again in the browser the first time it is used (its loads run again).
- SuspenseList (reveal order): deferred.

## Cost

- Pay-per-use: `Async` checks one nullable hook; importing `Suspense`, `startTransition` or `useTransition` installs it. Apps importing none ship none of it (router/dom +14 B, router/server +18 B min).
