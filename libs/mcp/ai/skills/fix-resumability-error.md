---
name: rivet-fix-resumability-error
description: Diagnose and fix Rivet resumability errors - RV2xxx compiler diagnostics, RV1016 handler errors, "is not serializable" / "Cannot resume" build or prerender errors, browser globals during server rendering, state that resets after the first click. Use when a Rivet build, check or page fails with such an error.
---

# Fix a resumability error

A Rivet page is rendered on the server and resumed in the browser: handlers, bindings and client effects run there with the values they capture, which the server serialized into the HTML. Errors come from code that cannot cross that line.

1. Get the exact diagnostic: `npm run check` (`file:line:col - error RVnnnn`), the Vite overlay (`[RVnnnn] file:line:col`), or `check_code(source, filename)`. For the fix: `explain_diagnostic("RVnnnn")`; `check_code` also returns the quick-fixed source when one applies.
2. Common codes:
   - RV2001 browser global (`window`, `document`, `localStorage`) read during server rendering → move it into a handler, `clientEffect(() => …)`, `clientEvent(window, "resize", …)` or `clientOnly(() => import("…"))`.
   - RV2003 captured class instance (`new Intl.NumberFormat`, an SDK client) → capture plain data; create the object inside the handler or `clientEffect`, or build it with `reconstruct(() => new X(…))` from `@rivetjs/runtime/dom` (the browser runs the factory on first read). A data class declared in the component module (plain fields) resumes as is.
   - RV2102 captured instance of a module class that cannot resume as data (`#private` field, a decorator, a field arrow using `super`, a base that is not a data class of the module, `window` / `document` / `WebSocket` read while constructing) → create it inside the handler, build it with `reconstruct(() => new X(…))`, keep only plain fields, or add `[serialize]()` + `static [revive](data)` (from `@rivetjs/runtime/resume-format`; package classes: `registerClass(Cls, { id, serialize, revive })` in a module imported by the server code and the resume entry). At render, `RV2102: X has [serialize] but no static [revive]` → add the `static [revive]`.
   - RV1016 handler expression reads state when it binds (`onClick={a() ? f : g}`) → wrap: `onClick={(e) => (a() ? f(e) : g(e))}`.
   - RV2002 ref callback must assign a local → `ref={(el) => (local = el)}` or `const el = ref()` + `ref={el}`.
   - RV2006 JSX inside a handler / effect / computed → render JSX in the component, switch it with a signal.
   - RV2007 `this` in resumable code → `event.currentTarget`.
   - RV2009 two module references share a browser name (two imports of different modules under one name) → rename one import (`import { fmt as fmtDate } from …`).
   - RV2101 (warning, type-aware) a captured value's type does not serialize → as RV2003.
3. Build / prerender error `Cannot resume <file>#<Component>$<hash>: function is not serializable` (dev server: ``capture `<name>` function is not serializable``; dev build: `capture #<i> …`): a captured function Rivet did not compile (created at runtime by a library such as `memoize(fn)`, a `.bind(…)` written inside an object literal (keep `const inc = add.bind(null, 2)` in a local constant and store `inc`; `.bind(ctx)` of a function using `this` stays RV2007), a method, or held by an object built outside a component: at module level such as `const table = { format: formatEuro }`, or by your own hook / helper such as `function useFormat() { return { format: formatEuro }; }`). Wrap it in an inline arrow, or build the object inside the component (module-level and imported functions used by name there resume by reference). A library object holding functions (a chart, editor, socket client from a package): build it with `reconstruct(() => createChart(…))` from `@rivetjs/runtime/dom` — no value in the page, the browser runs the factory on first read (module level: one server instance per process, never read request state in it). A class instance at render (`X instance is not serializable`): your class → `reconstruct(() => new X(…))` or `[serialize]()` + `static [revive](data)`; a package class → `registerClass(X, { id, serialize, revive })` from `@rivetjs/runtime/resume-format`. `NODE_ENV=development vite build` names the value path. Rules: `get_doc("docs:/best-practices/serializable-captures/")`.
4. State resets on the first change after resume: a child destructures its props (`function C({ value })`) and is re-created → read `props.value`. Copies of `props.children` in a local are not tracked → render `{props.children}` directly.
5. `.ts` module importing `@rivetjs/runtime/dom` (bundles the DOM runtime into SSR) → move that code into a `.tsx` file.
6. Re-run `npm run check` and `npm run build` (prerender exercises serialization); both must be clean.
