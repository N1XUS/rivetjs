# Slots and in-file server code (design)

Date: 2026-10-03. Status: proposal, not implemented. Builds on [router design](2026-10-03-router-design.md), [resumability design](2026-10-03-resumability-design.md), [async streaming](2026-10-03-async-streaming-design.md), [docs/guides/resumability.md](../../guides/resumability.md).

Two features, separate:
- **A. Slots**: default + named + scoped slots, lazy rendering, resumable.
- **B. Server code in route files**: `load` / `guard` / `actions` / … as named exports of `page.tsx`, stripped from client bundles by the compiler.

---

# A. Slots

## A1. Where things stand (from the code)
- DOM: component element → `component(fn, () => props)` ([dom.ts](../../../libs/runtime/dom.ts) `component`): `wrap(() => fn(props()))`. JSX children land in `props.children` and are built **eagerly**, inside the child's owner but *before* `fn` runs, so context the child provides does not reach them.
- Server: `Expr::Component` ([ir.rs](../../../libs/compiler/rust/src/ir.rs)) prints `Callee({ ...props, children })`; children are `ServerTemplate`s whose slot expressions run when the call is built (eager). Twins (flattened components, `discover_twins` in [compile.rs](../../../libs/compiler/rust/src/compile.rs)) pass props positionally.
- Lowering: `Compiler::lower` (component branch) + `child_expressions` (compile.rs ~999–1100). The only lazy case is a special case: `Provider` children are wrapped in a thunk (`is_provider`).
- Function children already render lazily in both runtimes:
  - DOM `insert` (dom.ts ~176): a function → boundary + `bindChild` (reactive, owned);
  - server `visit` (server.ts ~632): a function is called at traversal time under the request signal.
  - So `{props.header}` with `header = () => <h2/>` works today, outside resume mode.
- Render props already exist for built-ins: `For` children `(item, index) => …` (accessors), `Async` children `(value) => …`, `fallback`.
- Resume: a JSX-bearing arrow passed to a user component is not a symbol. If the *child* captures it in a reactive site (`{open() && header()}`), the server encoder hits a plain function → `function is not serializable` ([resume-format.ts](../../../libs/runtime/resume-format.ts) l.115). Eager `children` captured the same way fail too (`ServerTemplate` is not serializable). Captured *local* functions already serialize as `{f: sym, a: captures}` (`SiteKind::Fn` in [resume.rs](../../../libs/compiler/rust/src/resume.rs), `fnEntry` in [server-resume.ts](../../../libs/runtime/server-resume.ts) l.676, decoded at resume-format l.245).
- Typing: `JSX.ElementChildrenAttribute { children: {} }` ([jsx-runtime.ts](../../../libs/runtime/jsx-runtime.ts)); `JSX.Element` is opaque (`CompiledElement`), so TS cannot tell `<Card.Header>` from `<div>` in a children position.

## A2. Goal
- Named slots, default slot, scoped slots (slot args), fallback, presence checks.
- Lazy: an unused slot costs nothing (no template built, no slot expressions run, server or DOM).
- Resumable: a child region that re-creates on the client can re-render a slot defined in the parent without running either component function.
- Fully type-checked in plain TSX (no TS plugin): missing required slot, unknown slot, wrong slot args → `tsc` errors.
- Zero cost: ssr-bench HTML and compiled output byte-identical; modules that do not pass functions to components compile unchanged.

## A3. Options compared

| Option | Example | TS checks slot names/args | Lazy | Scoped | Resumable | Compiler work | Notes |
|---|---|---|---|---|---|---|---|
| S0 Value props (today) | `header={<h2/>}` | names yes, args n/a | no | no | no (if child captures it) | none | eager; context from parent |
| **S1 Function props ("snippets")** | `header={() => <h2/>}`, `row={(item) => <li/>}` | **yes** | **yes** | **yes** | **yes** (symbol + captures) | Slot site in resume mode only | Svelte 5 snippets / Solid render props / React render props |
| S2 Compound member tags | `<Card><Card.Header>…</Card.Header></Card>` | no (`JSX.Element` opaque) | needs compiler to know `Card.Header` is a slot (cross-module, untyped) | awkward | yes if lowered to S1 | cross-module resolution | collides with real compound components; already compiles today as a plain component call |
| S3 `<template slot="header">` | `<template slot="header"><h2/></template>` | no | via lowering | `let:`-style attrs untyped | via lowering | lowering pass | hijacks the native `<template>` element |
| S4 `slot:` directive | `<h2 slot:header>…</h2>` | no; required slot props become TS errors (TS sees no `header` attr) | via lowering | no | via lowering | lowering pass | fits `model:` / `window:` namespace style, but weakens types |
| S5 Web-component `<slot>` / `slot=""` | `<slot name="header">fallback</slot>` | no | no (light DOM always exists) | no | n/a | n/a | needs shadow DOM / DSD for SSR |

Prior art:
- Vue: `<slot name>` + `v-slot:name="props"`; compiled to functions (lazy); fallback inside `<slot>`; `$slots.x` presence; types via `defineSlots`. Template-only syntax.
- Svelte 5: snippets `{#snippet header(a)}` passed as props, `{@render header?.(a)}`, `Snippet<[A]>` type; `children` is an implicit snippet. Closest to S1.
- Solid: JSX props compiled as getters (lazy on access); `children()` helper to memoize; named slots = props; known footgun: reading `props.children` to check presence renders it.
- Angular: `<ng-content select>` projects eagerly-created content (created even when not shown); lazy/scoped needs `<ng-template>` + `ngTemplateOutlet`.
- Web components: `<slot>` / `slot="x"`; light DOM always instantiated; fallback content; `slotchange`.
- Qwik: `<Slot name>` + `q:slot`; projection lets parent/child render independently (resumability driver); slot names untyped.

## A4. Recommendation: S1, slots are function-valued props
- A slot is a prop whose value is a function returning JSX. Default slot = `children`. Named slot = any prop. Scoped slot = slot with parameters.
- Why:
  - only option whose names *and* args are checked by plain `tsc`;
  - lazy by construction (no new runtime: both runtimes already render functions lazily);
  - one mechanism for named, default, scoped; matches `For` / `Async` render props already in the API;
  - resumes cleanly: a function literal has a lexical home (parent component) → symbol + explicit captures, same model as `SiteKind::Fn`;
  - zero-cost: opt-in by syntax; nothing changes for value props.
- Value props (S0) stay valid: a slot prop typed `Content` accepts both; `{props.header}` renders either (value eager, function lazy).
- Sugar (S2/S4) deferred; see open questions.

## A5. Syntax
```tsx
import type { Slot, Content } from "@rivetjs/runtime";

interface CardProps {
  header?: Content;                       // value or slot; rendered with {header}
  footer?: Slot;                          // lazy slot
  row: Slot<[item: () => Item, index: () => number]>;  // scoped slot (accessor args, like For)
  items: () => Item[];
  children?: Content;                     // default slot
}

export function Card({ header, footer, row, items, children }: CardProps) {
  const open = signal(true);
  return (
    <article>
      <header>{header ?? <h2>Untitled</h2>}</header>          {/* fallback */}
      {children}
      <ul><For each={items}>{(item, i) => row(item, i)}</For></ul>
      {footer && open() ? <footer>{footer()}</footer> : null}  {/* presence check: no render */}
    </article>
  );
}

// Use
<Card
  items={items}
  header={() => <h2>{title()}</h2>}
  row={(item) => <li>{item().name}</li>}
  footer={() => <small>{count()} items</small>}
>
  {() => <p>Lazy default slot</p>}
</Card>

<Card items={items} row={(item) => <li>{item().name}</li>} header={<h2>Eager value</h2>}>
  <p>Eager default slot (today's semantics)</p>
</Card>
```
- Presence: `if (props.footer)` / `footer && …` — never renders (unlike Solid's getter).
- Fallback: `{header ?? <Fallback/>}` or ternary. "Fallback when the slot renders nothing" (Vue) is not supported: it needs a render to decide.
- Rendering: `{slot}` (no args) or `{slot(a, b)}`; `{slot?.()}` for optional.
- Scoped args: pass accessors for data that changes (fine-grained updates inside the slot, same as `For`); plain values allowed (change → slot re-created).
- Context: slot content runs where it is rendered (child's owner) → sees context the child provides (Tabs/Menu patterns, no `Provider` thunk trick). Captures are lexical (parent). Eager value children keep today's behavior.
- Ownership: slot output is owned by the child's region that renders it; disposing the region disposes it.

## A6. Compiler changes
- [resume.rs](../../../libs/compiler/rust/src/resume.rs): new `SiteKind::Slot`.
  - Site = arrow / function expression containing JSX that is (a) an attribute value on a non-native, non-`TARGET_HELPERS` element, or (b) a direct expression child of such an element.
  - Captures: same free-variable analysis as `Fn` (closure-local captures; module scope stays imports); same diagnostics (class instance, DOM node, `this`). JSX allowed in body (as `Fn`, l.617).
  - Symbol `<module>#<Parent>$<n>`; numbering in source order, identical in both targets (analysis runs on the same source).
  - `For` / `Async` / `Provider` / `clientOnly` callbacks keep their current treatment (they sit inside the parent's own region symbol).
- [compile.rs](../../../libs/compiler/rust/src/compile.rs) `lower` (component branch), resume mode only:
  - server: wrap the function value as `_rs(sym, [captures], fn)` → registers meta in the recorder's `fns` map, returns `fn` unchanged;
  - DOM: hoist the symbol (`(captures…) => fn`) into the parent's symbol chunk with its DOM template, like other render sites.
  - non-resume modules: no change (arrow passes through as today) → byte-identical.
- [facts.rs](../../../libs/compiler/rust/src/facts.rs): no change (slot belongs to the parent module/component; chunk grouping unaffected).
- Diagnostics (new):
  - resume module, child: a destructured prop used inside a reactive site *and* rendered as a value → none at compile time (parent may pass a function); runtime error improved (A7).
  - Spread props still unsupported on components (existing).
- Twins / server list plans ([compile.rs](../../../libs/compiler/rust/src/compile.rs) `plan_of`, `twin`): function props are ordinary dynamic slots → no plan change; if a twin plan refuses a function-valued positional prop, fall back to the plain call (no new fast path in v1).

## A7. Runtime changes
- `@rivetjs/runtime` types ([jsx-runtime.ts](../../../libs/runtime/jsx-runtime.ts), re-exported from `/dom`, `/server`):
  - `type Slot<A extends unknown[] = []> = (...args: A) => JSX.Element;`
  - `type Content = JSX.Element | Slot;`
- [server-resume.ts](../../../libs/runtime/server-resume.ts): `_rs(sym, captures, fn)` = existing `fns` registration path (`fnEntry` → `{f, a}`); without a recorder → returns `fn` (degrades like other `_r*`).
- Error text for value content captured by a resumable site: `capture <path>: rendered content is not serializable — pass it as a slot: header={() => <…/>}` (dev path naming per [dev builds](2026-10-03-dev-builds-design.md)).
- [dom-resume.ts](../../../libs/runtime/dom-resume.ts) / [resume-format.ts](../../../libs/runtime/resume-format.ts): none — `{f, a}` already revives a callable (hook(symbol, captures)).
- [dom.ts](../../../libs/runtime/dom.ts), [server.ts](../../../libs/runtime/server.ts): none (functions in child positions already lazy).
- Preload ([server-resume.ts](../../../libs/runtime/server-resume.ts) `planPreload`): region/handler entries whose captures reach `{f}` slot refs list the slot's chunk as a dependency → prefetched with the child chunk, so re-creation stays synchronous.

## A8. Resumability impact
- Static projection (`{header}` in a non-reactive position): server calls the slot during render; no region, no state entry, no symbol shipped unless captured.
- Child re-creates a region containing a slot (`{open() && footer()}`): state carries `{f: Parent$n, a: [...]}`; browser loads the slot symbol (parent's chunk) + child region symbol; neither component function runs (`__componentRuns` stays unset).
- Slot reading signals at top level of its body: tracked by the enclosing child site (correct; region re-creates on change). Reactive parts inside the slot's JSX are the parent's own bindings (resumed in place).
- Streaming: slot rendered inside a streamed `Async` runs at segment time, attributes to that boundary; its chunk joins the patch's chunk list. Eager children would have run their slot expressions in the shell pass — slots avoid that work for content that may never stream.
- Serializability of captures follows existing rules; slot args are passed at call time (child scope), not serialized with the slot.

## A9. Typing
- Names/required/unknown: ordinary prop checks.
- Args: `Slot<[item: () => Item]>` checks the arrow parameters at the use site (contextual typing) and the call in the child.
- Default slot as function: `children: Slot` → `<Card>{() => <p/>}</Card>` type-checks via `ElementChildrenAttribute`.
- `Content` lets authors accept both forms; a component that calls `children(x)` must type it `Slot<[X]>`.
- Type tests (`// @ts-expect-error`): missing required slot, wrong arg arity/type, value passed where `Slot<[X]>` required.

## A10. Performance / zero cost
- ssr-bench sources pass no functions to components → compiler output and HTML byte-identical (gate).
- Non-resume modules: no output change at all.
- Resume modules: change only where a JSX-returning function is passed to a user component. Known instance: generated `.rivet/app.tsx` (`<Router notFound={(url) => …}>`) → becomes a Slot site (one `_rs` call per render; acceptable, recorded in the change).
- Server cost per slot: one closure (same as today's arrow) + one call at visit; vs eager: template object built even when unused. Expected ≤ eager; conditional slots strictly cheaper.
- Microbench (not an ssr-bench lane): 1,000 cards, eager children vs slots vs conditional slots; gate: slot lane within 2% of eager throughput on the always-rendered case.

## A11. Migration
- None required: value `children` / value props unchanged.
- Docs: "slots" section (named = props, lazy = function, scoped = args, context from render site).
- Optional later: `Provider` children become a `Slot` (removes the `is_provider` thunk special case) — only if output stays identical.

## A12. Testing
- Compiler ([resume-compile.test.ts](../../../libs/compiler/tests/resume-compile.test.ts)): Slot site detection (attr, child, nested), captures, server/DOM symbol id agreement, structural helpers excluded, non-resume byte-identical.
- Zero cost: every tracked `.tsx`/`.jsx` source without slot sites compiles byte-identically (both targets, direct on/off); ssr-bench HTML identical.
- Server resume ([server-resume.test.ts](../../../libs/runtime/tests/server-resume.test.ts)): captured slot → `{f, a}`; value content captured → improved error.
- Browser ([resume-browser.test.ts](../../../libs/runtime/tests/resume-browser.test.ts), Chromium): child toggles a region with a parent slot → re-created, no component runs; scoped slot in `For` rows updates via accessors; slot sees child-provided context; preload pulls slot chunk with child chunk (sync first interaction).
- Streaming ([server-stream.test.ts](../../../libs/runtime/tests/server-stream.test.ts)): slot inside streamed `Async` → segment carries slot chunk.
- Differential: CSR `mount` vs SSR+resume identical DOM after interaction scripts on a slots fixture.
- Type tests: A9 cases.

## A13. Open questions (recommendation first)
1. Named-slot sugar (`slot:header`, `<Card.Header>`, `<template slot>`)? — **No in v1** (untyped; breaks required-slot checks). Revisit only with a TS language-service plugin. Alt: `slot:` lowered to S1 with slots forced optional.
2. Auto-lazy JSX children (compiler thunks every component's JSX children, Solid-style)? — **No**: changes output of every component with children, changes context/ownership timing, breaking. Alt: auto-lazy only in resume modules (inconsistent semantics between modes).
3. Scoped slot args: accessors or values? — **Accessors for changing data** (matches `For`, fine-grained); values allowed. Alt: values only (simpler, re-creates on change).
4. Slot content context: render site (child) or definition site (parent)? — **Render site** (function-call semantics; enables Tabs/Menu). Alt: capture parent context at definition (Svelte-like `getContext` at snippet creation; needs extra runtime).
5. Value content captured by a reactive site in a resume module: error or auto-wrap? — **Error with fix hint** (explicit). Alt: compiler wraps JSX children in thunks when the child is in a resume module (needs cross-module knowledge).

---

# B. Server code in route files

## B1. Where things stand (from the code)
- Scanner ([routes.ts](../../../libs/router/build/routes.ts)): `x.tsx` = universal page, sibling `x.server.ts` = `guard`/`load`/`entries`/`prerender`/`actions`/`headers`/`GET…` (`ServerModule`, [handler.ts](../../../libs/router/server/handler.ts)); endpoint-only route = `.server.ts` without page; `_404`/`_error` may not have server modules.
- Codegen ([codegen.ts](../../../libs/router/build/codegen.ts)): server table `server: () => import("x.server.ts")`; client `app.tsx` imports only pages/layouts; CSR mode errors on any `.server.ts`.
- Guard ([vite.ts](../../../libs/router/build/vite.ts) `resolveId`): browser graph importing `*.server.*` → build error (tested: [codegen.test.ts](../../../libs/router/tests/codegen.test.ts) l.107).
- Type flow: none. Pages hand-write `PageProps<Item[]>`; `routes.d.ts` types params only. Nothing connects the loader's return type to the page.
- Gap: the playground's loader imports `../services/server.ts` — not `*.server.*`, so the guard would not catch it if a page imported it.
- Compiler: [strip.rs](../../../libs/compiler/rust/src/strip.rs) already elides never-referenced value imports in TS files (TypeScript semantics); oxc semantic scoping is available in every compile.
- Client builds compile resume modules twice: `buildStart` (symbol chunks + `moduleFacts` resolved via Vite) and `transform` ([compiler vite.ts](../../../libs/compiler/vite.ts) l.117–135, l.272). Facts resolve every static import in the client environment → an unstripped server import there would trip the `.server` guard.

## B2. Goal
- One route file can hold component + server exports; no second file required.
- Server code and its exclusive dependencies never reach client bundles (build + dev), guaranteed by deterministic compiler analysis, verified by a post-compile check and by build tests — not by bundler tree-shaking.
- Loader data typed into the page without hand-written types.
- Same handler semantics as `.server.ts`; static/prerender/CSR rules unchanged; HMR at least as good.
- Zero cost: modules without server exports compile byte-identically.

## B3. Options compared

| | A. Sibling `x.server.ts` (today) | **B. Named exports in `x.tsx`** | C. Wrapper `serverLoad(fn)` / `routeLoader$` | D. `"use server"` directive | E. B + A kept |
|---|---|---|---|---|---|
| DX | 2 files/route; clear boundary; "which file?" confusion | 1 file; Remix/RR familiar; names = today's `ServerModule` | 1 file; new API per hook | 1 file; directive semantics overloaded | 1 file default, 2nd file when wanted |
| Secret safety | file boundary + `resolveId` guard (strong, simple) | compiler strip + DCE; risk: module-scope code shared with component | same as B (marker call instead of export name) | functions become public RPC endpoints (exposure by design) | B's, plus `.server.*` modules as the hard boundary for secrets |
| Tree-shaking reliance | none (whole module excluded) | none if compiler-side DCE (not Rollup); Remix-style babel DCE has leaked historically | same as B | bundler/RSC transform | same as B |
| Type flow | `typeof import("./x.server").load` (manual) | `PageProps<typeof load>` in-file | `ReturnType` of wrapper | n/a (RPC call types) | both |
| HMR | `.server.ts` edit → next request | client output unchanged → no client update; server next request | same as B | — | both |
| Static/prerender | `entries`/`prerender` in server file | same exports, in-file | wrapper options | n/a | both |
| Testing loaders | plain TS, `node --test` directly | needs JSX compile (`.tsx`) or test via handler | same as B | — | keep big loaders in `.server.ts` |
| Prior art | SvelteKit `+page.server.ts`, Nuxt `.server.vue` | Remix / React Router `loader`/`action` (+ `.server` modules, `serverOnly$` as backstops) | Qwik `routeLoader$` (must be exported from route file) | Next server functions, SolidStart `"use server"` | React Router (route exports + `.server` modules) |

Prior-art lessons:
- SvelteKit: two loads (`+page.ts` universal vs `+page.server.ts`) are its most common confusion; `$lib/server` + `$env/static/private` import guards are what make it safe → keep Rivet's `.server.*` guard.
- Remix / React Router: export stripping + dead-code elimination leaks when module-scope code with side effects is shared; they added `.server` modules and `vite-env-only` macros as backstops → Rivet's strip must be scope-exact and verified, with `.server.*` as the backstop.
- Qwik: `routeLoader$` only runs when re-exported from a route file — silent no-op if not; markers tied to file position confuse → use fixed export names, error on misuse.
- Next / SolidStart `"use server"`: marks *callable endpoints* (RPC), not page data; every such function is publicly reachable; serialization of arguments is an attack surface (RSC Flight deserialization RCE, CVE-2025-55182) → do not reuse the directive for loaders; reserve it for a future, separately designed server-functions feature.

## B4. Recommendation: E — named exports in the route file, `.server.*` modules stay the secret boundary
- `page.tsx` / `_layout.tsx` may export `load`, `guard`, `actions`, `entries`, `prerender`, `headers` (same contract as `ServerModule`). Client compile removes them and everything only they reach.
- Sibling `x.server.ts` stays supported (no breaking change); same export in both → build error naming both files.
- Endpoint-only routes (`GET`/`POST`/… without a page) stay `x.server.ts`; method exports in `x.tsx` → compile error ("move to x.server.ts").
- Secrets (DB clients, keys, internal SDKs) live in `*.server.ts` modules (or modules importing `@rivetjs/router/server-only`); inline loaders import them. The guarantee therefore never depends on DCE alone: if a server-only import survives into client output, the build fails.
- Why not A only: the user's DX concern is real (two files per data route; SvelteKit's top confusion). Why not C: adds API for no capability over fixed names. Why not D: wrong semantics (RPC), larger attack surface.

## B5. Syntax
```tsx
// src/routes/items/[id].tsx
import { notFound, type PageProps, type RequestEvent } from "@rivetjs/router";
import { db } from "../../services/db.server.ts";   // server-only module: removed from the client

export const load = async ({ params, signal }: RequestEvent<"items/[id]">) => {
  const item = await db.item(params.id, signal);
  if (!item) throw notFound();
  return item;
};

export const head = ({ data }: PageProps<typeof load>) => ({ title: data.title });  // universal

export default function Detail({ data }: PageProps<typeof load>) {   // data: Item (inferred)
  return <h1>{data.title}</h1>;
}
```
```tsx
// _layout.tsx
export async function guard({ locals }: RequestEvent) { if (!locals.user) throw redirect("/login"); }
export const load = ({ locals }: RequestEvent) => ({ user: locals.user as User });
export default function Layout({ data, children }: LayoutProps<typeof load>) { … }
```
- Client output of `[id].tsx`: `head` + `Detail` only; `load`, `db` import gone.
- Allowed forms: `export const|let|var name = …`, `export [async] function name`, `export { local as load }` (local binding), `export { load } from "./x.server.ts"` (re-export: dropped on client).
- Errors: `export *` in a route module; `export default` that is not the component; server export name referenced as a value by universal code (e.g. `head` calls `load`); server export on `_404`/`_error`; inline + sibling define the same export; method exports in `.tsx`.

## B6. Compiler changes
- New pass `libs/compiler/rust/src/server_split.rs`, enabled per module by compile option `serverExports: true` (camelCase in [lib.rs](../../../libs/compiler/rust/src/lib.rs) `CompileOptions`; router passes route + layout modules, like `resume.modules`).
  - Input: parsed program + `oxc_semantic` scoping (value references only; type references ignored — `typeof load` stays legal).
  - Roots = server export declarations. Fixpoint: a module-scope binding (function, class, variable declarator, import specifier) is removed when every value reference to it lies in removed code. Imports: drop removed specifiers; drop the declaration when all specifiers go (incl. default/namespace). Bare `import "x"` and top-level expression statements stay (universal by definition).
  - Shared binding (referenced by removed and kept code) stays; if it is (transitively) initialized from a server-only import → error: "`db` is used by `load` and by client code (`Detail`, line N); server-only modules cannot reach the browser".
  - DOM target: removal spans fed into compile.rs's existing in-place splice (before JSX lowering and `strip_types`). Server target: no removal, same diagnostics (errors identical in both builds).
  - Resume analysis ([resume.rs](../../../libs/compiler/rust/src/resume.rs)) runs on the unstripped AST in both targets → symbol names/ids agree by construction; a resume site inside removed code → error (server code is not resumable).
  - Output adds `serverExports: string[]` and `serverImports: string[]` (specifiers removed) for the plugin.
- [facts.rs](../../../libs/compiler/rust/src/facts.rs) `moduleFacts`: take the same option; report `serverExports`; `statics`/`dynamics` exclude removed imports (otherwise `buildStart` resolves server imports in the client environment).
- [strip.rs](../../../libs/compiler/rust/src/strip.rs): unchanged (JS files: our pass removes imports explicitly, since `only_remove_type_imports` keeps them).
- [hot.ts](../../../libs/compiler/hot.ts): unchanged; it reads compiled (stripped) code, so `load` never becomes a hot "value export".

## B7. Runtime / router / plugin changes
- [compiler vite.ts](../../../libs/compiler/vite.ts): new option `serverExports: { modules }`; applied in `transform` (DOM target) and the `buildStart` resume compile + `moduleFacts`. Post-compile verification on every DOM compile: parse remaining imports (es-module-lexer) → error if any matches `*.server.*`, `@rivetjs/router/server-only` importers, or `node:` builtins.
- New marker module `@rivetjs/router/server-only` (empty on server; client resolution → build error) for server modules that cannot be renamed.
- Scanner ([routes.ts](../../../libs/router/build/routes.ts)): no new file kinds; `RouteModule` gains `inline?: readonly string[]` (server export names from facts, read at scan time via `moduleFacts`).
- Codegen ([codegen.ts](../../../libs/router/build/codegen.ts)):
  - server table: `server: () => import("x.tsx")` when inline exports exist (layouts: reuse the static `L<n>` namespace); sibling → as today; both with the same export → error.
  - CSR mode: inline server exports → same error as `.server.ts` today.
  - `routes.d.ts`: add `RouteData` map (`id → DataOf<typeof import("…").load>`), works for inline and sibling.
- Static adapter: "has server module" = inline exports or sibling (from facts); `entries`/`prerender` read from whichever module defines them.
- Handler ([handler.ts](../../../libs/router/server/handler.ts)): unchanged (it receives a `ServerModule`; the page module's namespace satisfies it).
- Rename playground `services/server.ts` → `services/server.server.ts` (or add `import "@rivetjs/router/server-only"`): today it is not guarded.

## B8. Typing
- `type DataOf<T> = T extends (...a: never[]) => infer R ? Awaited<R> : T;`
- `PageProps<D | typeof load, P>` / `LayoutProps<…>`: `data: DataOf<D>` — existing `PageProps<Item[]>` keeps working.
- `RequestEvent<P>` also accepts a route id: `RequestEvent<"items/[id]">` → params from `RouteParams`.
- `ActionProps<typeof actions>` for action results.
- Generated `RouteData` (B7) for layout-child / `href` typing and for sibling-file routes.
- Optional: `Serializable<T>` check on `DataOf` (functions, class instances → type error), matching the resume encoder's refusals (open question 4).

## B9. HMR / dev
- Dev client compiles route modules with the strip (no secrets in dev either; same verification).
- Edit inside `load`: client output unchanged → compiler plugin returns identical code → no client update; server: Vite SSR graph invalidates, next request/navigation uses the new loader (parity with `.server.ts` today).
- Edit to component: unchanged behavior (self-accept, state kept).
- Optional: router plugin sends `rivet:data` after a server-only change; `entry.dev.tsx` refetches route data and re-mounts (state resets) — open question 3.

## B10. Security: how it is guaranteed and tested
- Layers:
  1. scope-exact removal (Rust, oxc semantic), not bundler tree-shaking;
  2. shared-binding diagnostic (no silent keep of server-tainted code);
  3. post-compile import verification in the plugin (every DOM compile, build and dev);
  4. existing `resolveId` guard for `*.server.*` + new `server-only` marker;
  5. build tests with canaries.
- What it cannot catch: a secret hard-coded in a binding that the component also uses. Rule (documented): secrets only in `*.server.*` modules / env read inside server code.
- Tests:
  - Rust unit + `libs/compiler/tests/server-exports.test.ts` (table-driven): each export form; fixpoint chains (helper → helper → import); shared binding kept/erroring; type-only refs; bare imports kept; JS files; source maps map kept code; diagnostics; server target unchanged.
  - Symbol agreement: inline-load route modules produce identical resume symbol ids in both targets.
  - Canary e2e (`libs/router/tests/fixture-inline`): `secret.server.ts` exports `"CANARY_<random>"`; route-local `const internal = "CANARY_LOCAL"` used only by `load`; `vite build` → scan `dist/client/**` + manifests: no canary, no `.server` module ids; dev server: fetch transformed route module → no canary.
  - Parametrized handler suite: [server.test.ts](../../../libs/router/tests/server.test.ts) / [app.test.ts](../../../libs/router/tests/app.test.ts) run with sibling and inline conventions (guards order, loaders, actions + CSRF, data endpoint).
  - Static: inline `entries`/`prerender`; CSR error with inline exports.
  - Negative: client code importing a route's `load` → plugin error, not a missing-export bundler error.

## B11. Performance / zero cost
- Route modules without server exports: pass is a no-op → byte-identical output. ssr-bench uses no router → unaffected.
- Client bundles: unchanged or smaller. Server: route module now also serves as server module (already loaded for `head`).
- Compile: one extra fixpoint over module-scope symbols, only for route modules with server exports.

## B12. Migration
1. Ship strip + facts + verification; both conventions work; docs teach inline first.
2. Codemod `rivet migrate server-exports`: for each page with a sibling `.server.ts` (no method exports): move exports + imports into `x.tsx`, rename collisions, replace `PageProps<T>` with `PageProps<typeof load>`; delete the sibling; leave endpoint-only files.
3. Playground: migrate `index`, `items/[id]`, `resume`; rename `services/server.ts` → `*.server.ts`; keep `api/items.server.ts`.
4. Sibling form stays supported (no deprecation planned; see open question 1).

## B13. Open questions (recommendation first)
1. Keep sibling `x.server.ts` for pages long-term? — **Keep, documented as the "large loader / testable in plain TS" option**. Alt: deprecate after codemod (one way only; loses plain-TS testability).
2. Method exports (`GET`/`POST`) inline in `.tsx`? — **No** (endpoints stay `.server.ts`; a page and an endpoint on one URL is confusing). Alt: allow for content-negotiated routes.
3. Dev auto-refresh after a loader edit? — **Yes, `rivet:data` event → refetch + re-mount** (cheap; state resets like today's app re-mount). Alt: keep "next request" only.
4. Type-level serializability check on loader data? — **Yes, with an escape hatch (`PageProps<Unchecked<typeof load>>`)** — catches functions/classes before the runtime encoder does. Alt: runtime error only (today).
5. Wrapper (`serverLoad(fn)`) as an optional typed helper? — **No** (fixed names suffice; one less API). Alt: add it for loaders defined outside route files and re-exported.
6. `"use server"` for RPC server functions? — **Out of scope; reserve the directive** for a separate design (explicit endpoint ids, origin/CSRF check, argument schema validation).

## Decisions (user, 2026-10-03)
- Slots: web-component style syntax, lowered by the compiler to lazy slot props (`Slot<A>`) from part A.
  - Component side: `<slot />` = default slot (`children`); `<slot r:name="header">fallback</slot>` = named slot with fallback content.
  - Usage side: `<Card><h2 r:slot="header">Title</h2>Body</Card>`; children without `r:slot` go to the default slot.
  - Scoped slots (slot arguments): open; plan proposes syntax before implementation.
  - Typing: named slots typed optional; slot-name checks by the language service (plain TS cannot check `r:slot` values).
  - Supersedes open question A1 (shorthand "No for v1").
- Server code: option A (server exports in the route file, sibling `*.server.ts` still supported), with names that say "server":
  - `serverLoad`, `serverGuard`, `serverActions`, `serverEntries`, `serverHeaders` (replace `load`/`guard`/`actions`/`entries`/`headers`); `prerender` stays a plain build-time flag.
  - Request handlers Qwik-style (https://qwik.dev/docs/routing/#endpoint-indexts): `onRequest` (any method, middleware-like), `onGet`, `onPost`, `onPut`, `onPatch`, `onDelete`; allowed in endpoint-only `.ts` routes and in `.tsx` routes.
  - Every `server*`/`on*` export and what only it references is stripped from client builds (part B safety layers unchanged); old names stay accepted in `*.server.ts` during migration with a codemod (`rivet migrate server-exports`).
  - Supersedes open question B2 (`GET`/`POST` in `.tsx`: now `onGet`/`onPost` allowed).


## Decisions — open questions resolved (user, 2026-10-03)
Unpicked questions take the recommended answer.
- slots-server-a2 · Auto-lazy children: No — Avoids a breaking change to output and context timing.
- slots-server-a3 · Scoped slot arguments: Accessors for changing data — Matches For; fine-grained updates; values still allowed.
- slots-server-a4 · Slot context source: Render site (child) — Plain function-call behavior; enables Tabs/Menu.
- slots-server-a5 · Non-lazy content in resume: Error with fix hint — Explicit and predictable.
- slots-server-b3 · Refresh after loader edit: Yes, refetch and re-mount — Instant feedback; state resets.
- slots-server-b4 · Loader data type check: Yes, with escape hatch — Unchecked<typeof load> opts out.
- slots-server-b5 · serverLoad() wrapper: No — Fixed names suffice; one less API.
- slots-server-b6 · "use server" functions: Out of scope; reserve directive — Separate design with endpoint ids, CSRF check and argument validation.
