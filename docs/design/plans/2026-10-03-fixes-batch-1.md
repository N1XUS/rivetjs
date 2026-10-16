# Fixes batch 1 — plan

Branch `fix-runtime-router-batch-1` (base `perf/ssr-beat-razor`). Per fix: failing test → fix → own commit.

1. **Disposed-owner listeners** — `libs/runtime/dom.ts` `bindEvent` / `bindModel` / `clientEvent`: drop events whose owner is disposed (focusout during removal). Test: `tests/dom/abi.ts` (focused input removed by branch switch + mount stop, no window error). Then drop blur-before-redirect in `libs/forms/enhance.ts` (covered by forms `app.test.ts` pageerror assert).
2. **Same-URL revalidation** — router `revalidate()` path: refetch current URL's route data, one commit. Forms: after successful enhanced submit, use action's fresh data if the JSON answer carries it, else one data request.
3. **`beforeLeave`** — router client hook: block/confirm client navigation + `beforeunload`. Wire autosave `shouldBlockLeave()`; docs.
4. **HMR lazy child state** — `libs/runtime/hot.ts` adoption of lazily loaded wrapped children; dev HMR test in `libs/router/tests/app.test.ts`.
5. **Strict generated code** — `.rivet/*` codegen output type-checks under `strict`; test typechecks generated fixture.
6. **Flaky static-build test** — find shared resource (NODE_ENV / dist / port), make deterministic; run router suite several times.
7. **DevTools names** — `displayName(…, { scoped: false })` option in `libs/devtools/protocol.ts`; Components pane drops `Scope ›` prefix under component header.
8. **Playground** — `rivetRouter({ transitions })`, shared-element transition list ↔ item (no edits to `_layout.tsx` / `tsconfig.json`); report client chunk sizes before/after.

Gates: runtime hash (deltas only for 1–2, justified), ssr-bench lanes identical, oracle 227/227, `npm run typecheck`, nx test.
