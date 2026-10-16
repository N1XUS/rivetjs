# Slots and in-file route server code: implementation plan

Spec: [2026-10-03-slots-and-server-markers-design.md](../specs/2026-10-03-slots-and-server-markers-design.md) (Decisions sections win).

## Syntax decisions taken here (spec left open)
- Component side:
  - `<slot />` = default slot (`children`); `<slot r:name="x">fallback</slot>` = named slot, fallback rendered only when the prop is `null`/`undefined`.
  - Scoped slot: `<slot r:name="row" r:args={[item, index]}>fallback</slot>` → calls the slot with the args (accessors recommended, like `For`).
  - Slot source = the component's first parameter: `props` identifier → `props.x`; destructured `{ x }` → local `x`; missing key → compile error naming the fix.
  - `<slot>` stays a native element inside `<template>` or with a plain `name` attribute (declarative shadow DOM).
- Usage side:
  - Direct child element with `r:slot="x"` (native or component) → lazy prop `x: () => <el/>` (several with one name → one thunk returning the list); `r:slot` itself is not rendered/passed.
  - Other children → `children` exactly as today (eager; decision a2). Lazy default slot: function child `{() => …}` (S1).
  - Scoped content: function-valued prop / function child (`row={(item) => <li>{item()}</li>}`); `r:slot` cannot declare parameters in plain TSX.
  - Errors: `r:slot` not directly under a component element; same name as an attribute; non-literal `r:slot`.
- Resume: `SiteKind::Slot` (resume.rs) for JSX-returning arrows/functions passed to components (attribute value or expression child) and `r:slot` thunks; server wraps with the existing `_rFn(id, fn, captures)` (no new runtime ABI → runtime bundles unchanged); DOM symbol = `(captures) => fn`. Symbol text rewrites inner `<slot>` elements to their lowered form; `<slot>` adds its props binding to captures.
- Server code names: `serverLoad`, `serverGuard`, `serverActions`, `serverEntries`, `serverHeaders`, `prerender` (plain flag), `onRequest`, `onGet`, `onPost`, `onPut`, `onPatch`, `onDelete`. Stripped on the client: every `server[A-Z]…` export + the `on…` list. Sibling `*.server.ts`: new names, old names (`load`, `guard`, `actions`, `entries`, `headers`, `GET`…) still accepted (both in one file → error).
- Endpoint-only routes: `x.server.ts` (today) or plain `x.ts` exporting a request handler (`onGet`, … / `onRequest`); plain `.ts` files without handlers stay ignored (helpers).
- Request handler semantics (Qwik-like, no `next()`): per request, chain modules outer → inner run `onRequest` then `on<Method>`; a returned `Response` ends the request; thrown `HttpError`/redirect as for guards. Page routes: `on<Method>` is middleware (non-GET methods allowed when the route module defines `on<Method>`; result `undefined` → page renders). Endpoint routes: the route module's `on<Method>` (or legacy `GET`…) produces the response.
- Strip mechanism: Rust `server_split.rs`, compile option `serverExports: true`; DOM target blanks removed code with spaces (newlines kept) → positions unchanged (source maps, diagnostics, resume symbol ids agree with the unstripped server compile); server target: same diagnostics, no removal. `moduleFacts(…, { serverExports })` reports `serverExports` and drops removed imports.

## Tasks (TDD: failing test first, then code; commit per milestone)
1. Slots compiler (Rust `slots.rs` + compile.rs): `<slot>` lowering (both targets), `r:slot` usage lowering, diagnostics. Tests: `libs/compiler/tests/slots.test.ts` (server HTML via runtime, DOM output, errors, zero-cost: modules without slot syntax unchanged).
2. Slot resume sites (resume.rs): `SiteKind::Slot`, captures through `<slot>`, symbol text rewrite. Tests: compile-level symbol agreement + `server-resume` serialization (`{f, a}`) + browser test (child toggles region with parent slot, no component runs; scoped slot in `For`; context from child).
3. Runtime types: `Slot`, `Content`, `Slots` in jsx-runtime.ts (+ re-exports), `slot` intrinsic attrs (`r:name`, `r:args`), `r:slot` on intrinsics and components (`IntrinsicAttributes`). Type tests with `@ts-expect-error`.
4. Server split (Rust `server_split.rs`, lib.rs option, facts.rs). Tests: `libs/compiler/tests/server-exports.test.ts` table-driven (export forms, fixpoint chains, shared binding error, type refs kept, bare imports kept, JS files, server target unchanged, positions kept, resume symbol agreement).
5. Compiler vite plugin: `serverExports: { modules }` in transform + buildStart + moduleFacts; post-compile import verification (`*.server.*`, `node:`). Tests in `vite.test.ts`-style.
6. Router: scanner facts (`inline` exports, plain `.ts` endpoints), codegen (server table from page/layout namespaces, merge with sibling, duplicate error, CSR error, `RouteData` types), handler (new names, on* handlers), `server-only` marker, types (`DataOf`, `PageProps<typeof serverLoad>`, `RequestEvent<"id">`, `Unchecked`, serializable check), static adapter, dev regeneration on route file change + `rivet:data` refresh. Tests: routes/codegen/server/app/static + canary e2e fixture (`fixture-inline`).
7. Codemod `rivet migrate server-exports` (`libs/router/bin/rivet.ts`): rename old names in `*.server.ts` (scope-aware via TypeScript language service); `--inline` moves sibling exports into the page. Tests.
8. Playground demos (new files only), docs (`docs/guides/slots.md`, `docs/guides/routing.md` section), gates.
