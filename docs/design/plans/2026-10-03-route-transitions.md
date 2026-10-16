# Route transitions + pending UI — implementation plan

Spec: [route transitions design](../specs/2026-10-03-route-transitions-design.md) (Decisions section wins; Q10 = typed `<Link>`).

Scope this pass: P0, P1, P2 core, typed `<Link>`. Deferred: route `pending` skeleton (`Async` delayed fallback), announcer, P3 nested outlets, P4 cross-document, programmatic `navigate(…, { transition })`.

## Task 1 — runtime: `Async` `hold` / `swap` (TDD)
- Test first (`libs/runtime/tests/dom-async.test.ts`): `hold` keeps old output mounted + live (effects/handlers) until the next commit; no fallback once something committed; `swap(apply, next)` receives a detached fragment, deferred `apply` works, stale `apply` (superseded generation) is a no-op and discards; error commits go through `swap`, fallback commits do not.
- Impl: `libs/runtime/dom.ts` `Async` (`hold` branches owned by the boundary owner, disposed inside `apply`).
- `Router` (`dom-router.ts`): `swap?`, `hold?: () => DOMValue` (first-generation placeholder; server Router ignores both).

## Task 2 — router client P0 + codegen (TDD)
- Codegen tests (`libs/router/tests/codegen.test.ts`): load = `Promise.all([routeData, loadPage(match.url)])`; no `settle` in `render`; Router gets `swap={swapRoute}` `hold={heldRoutes}`; popstate passes the event; intent honours `data-rivet-prefetch="none"`; transitions off → no transitions import / Provider / resume entry; on → lazy `import("@rivetjs/router/transitions")` on intent + in load, `Navigation` Provider in server entry, `entry.resume.ts`.
- `routes.d.ts`: `RouteRegistry.path` union → `RoutePath` (`"/" | \`/items/${string}\``) exported from `@rivetjs/router`.
- `client/index.ts`: navigation start record (`rivet:navigate` cancelable event, type/direction from `history.state.i`, trigger), `swapRoute` (sync `settle` after apply), `heldRoutes` (server DOM kept visible during the first resumed navigation), `onNavigate`, `useNavigation`, `data-rivet-replace`.

## Task 3 — transitions module P1/P2
- `client/navigation.ts`: `Navigation` context (id `rivet:navigation`) + browser signal.
- `client/transitions.ts`: `install(options)`; VT decision (support, enabled, link/route `false`, reduced motion, visibility, UA visual transition); types (`push|replace|back|forward` + link `data-transition` > route `transition`); `html[data-rivet-transition]`; `data-vt-name` intersection via CSSOM; `rivet-page` on routes host; events `rivet:before-swap` (defer ≤500 ms) / `rivet:after-swap` / `rivet:navigated`; pending: `aria-busy`, `data-rivet-pending` (+ Link pending classes), `html[data-rivet-pending]` after delay, held ≥ min.
- Unit tests (node, fake DOM where cheap): types precedence, name intersection (dupes dropped), timer logic.
- `dom-resume.ts`: arm context-provided signals (so `useNavigation()` regions in resumed layouts re-create).
- CSS: `transitions.css`, `tailwind.css`.

## Task 4 — `<Link>`
- `client/link.tsx` (`@rivetjs/router/link`): plain `<a href>` + data attributes; typed `to: LinkHref`.

## Task 5 — end to end (Chromium) — `libs/router/tests/transitions.test.ts` + `fixture-transitions`
- one `startViewTransition` per nav with expected types; back → `back`; `data-transition="none"` → none; reduced motion → none; no VT support → instant + events in order; shared element names only on intersection, cleared after finish; cold chunk: one swap of the routes region; old page live while pending; pending attributes (aria-busy immediate, html attr after delay); `useNavigation` in resumed layout; no transitions chunk before intent; strict CSP + Trusted Types + `style-src 'self'` → zero violations; `<Link>` SSR markup.

## Task 6 — docs + gates
- Spec Implementation notes (`RoutePath` for the language service), `docs/guides/routing.md`, playground demo route (new files only).
- Gates: rd hashes (justify deltas), lanes, oracle, typecheck, tests.
