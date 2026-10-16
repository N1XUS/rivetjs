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
- Streaming resumable (`_onSuspense` in server-resume): claimable site (same rule as Async) + fallback + a pending Async below → site claimed (`scope.async`), fallback in `<!--rA[-->…<!--]-->`, content (already constructed) streamed as one segment; resume records it made are moved from the current recorder into the segment's prepared view. No pending → inline. Failure → ErrorBoundary fallback segment or continuation (status 2).

## Resume

- No `dom-resume` / loader change: one `a` entry per streamed Suspense; continuation re-creates the region, whose DOM Suspense loads in the browser.
- `pending` signals serialize like any signal.

## Router

- Navigation = existing transition (`hold` + `swap` routes Async, `useNavigation()`); hold generations never register with a Suspense nor join a transition.

## Limits

- Transitions keep output only for in-place reloads (`load` reads the signal). Re-created subtrees (`{card(id())}`, new Show branch) show their fallback.
- Resumed page: the first change of a server-rendered region re-creates it (fallback once).
- SuspenseList (reveal order): deferred.

## Cost

- Pay-per-use: `Async` checks one nullable hook; importing `Suspense`, `startTransition` or `useTransition` installs it. Apps importing none ship none of it (router/dom +14 B, router/server +18 B min).
