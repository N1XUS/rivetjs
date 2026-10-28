# Framework bridges (islands) — design (2026-10-11)

- Status: **in implementation (lane BRIDGES, GO 2026-10-12)**; rulings in §11. Plan: [`../plans/2026-10-11-framework-bridges.md`](../plans/2026-10-11-framework-bridges.md).
- User directive (2026-10-11, verbatim): "biggest things to do: framework bridges, like astro."
- Meaning: host components written in React / Preact / Vue / Svelte / Solid inside Rivet apps as islands, the way Astro integrations do. The reverse direction (Rivet inside React / Vue / …) is a Phase 2 sketch (§10).
- Format precedent: [`2026-10-09-function-bridge-design.md`](2026-10-09-function-bridge-design.md). "Function Bridge" (resume of functions) is a different feature. This spec says **framework bridge**, or **foreign island**. "Island" in Rivet docs means a framework island only: the former chunk-grouping component `Island` is `ChunkGroup` since 2026-10-12 (`resume.chunks: "group"`, ruling Q3, §11).

## 1. Goal + non-goals

### Goal (v1)

- A component from React 19, Preact 10/11, Vue 3.5, Svelte 5 or Solid 1.9 is used as a JSX tag in a Rivet `.tsx` file:
  - typed props;
  - server-rendered into Rivet's stream, also inside `Suspense` segments and streamed patches;
  - static by default (0 B of that framework in the browser);
  - hydrated only when its `client` policy fires;
  - the framework runtime chunk loads lazily, once per page per framework.
- What crosses the boundary, beyond "serializable props", which is what Astro offers:
  - **live props**: a Rivet signal read in a prop re-renders the island through the adapter's update path, without re-hydrating;
  - **callbacks out**: inline arrows, local consts and imported functions resume through the Function Bridge (`_rFn` / `_rMod`), so a React `onClick` prop can call Rivet code;
  - **children + named slots**: Rivet content, still resumable, inside the foreign tree;
  - **nested islands**: a Svelte island in a React island's slot;
  - **error fallback**, persistence across router navigations, devtools rows.
- Zero-cost:
  - apps without foreign imports: byte-identical output, `scripts/zero-cost` unchanged;
  - Rivet-only pages in an app that has islands elsewhere: no bridge bytes and no state entries on those pages.
- Perf: beat Astro + React islands on the same page (TTFB, CPU per page, bytes before first input, hydration-to-interactive). Beat a Next.js page on the same content by more.

### Non-goals (v1)

- Shared reactivity across frameworks (a Rivet signal *inside* React code, React state read by Rivet). Only props in and callbacks out. A Rivet signal passed as a prop arrives as its value; a `Signal` passed as a value is refused, with a diagnostic (§7 RV2140).
- Context crossing. A React island does not see Rivet contexts, and Rivet slots inside an island do not see React contexts. This is Qwik's limitation too ("context will not be inherited").
- Server Components / React Server Functions, Vue `<Suspense>` streaming of partial islands, Svelte `{#await}` streaming. v1 renders each island to completion on the server; it may be async (§2.3).
- Angular, Lit, Alpine, Qwik adapters. The adapter contract allows them later.
- Running two Rivet compilers, or mixing frameworks inside one file. One file = one framework (same as Astro).
- Reverse direction (Phase 2, §10).

## 2. Research (read 2026-10-11 through the in-app browser)

### 2.1 Versions + licenses (npm via unpkg, 2026-10-11)

| Package | Version | License | Notes |
| --- | --- | --- | --- |
| `react` / `react-dom` | 19.3.0 | MIT | `react-dom/server`: `renderToString`, `renderToStaticMarkup` (legacy build), `renderToReadableStream`, `renderToPipeableStream`, `resume`, `resumeToPipeableStream`; `react-dom/static` `prerender`; `react-dom/client` `hydrateRoot` / `createRoot`. Repo already uses 19.3.0 in `apps/dom-bench`. |
| `preact` | 11.0.1 (10.x still common) | MIT | peer `preact-render-to-string >=6.7.0` (6.8.0); `hydrate` / `render` from `preact`. |
| `vue` | 3.5.43 | MIT | `createSSRApp` + `vue/server-renderer` `renderToString` (Promise) / `renderToWebStream`; client `createSSRApp(...).mount(el)` hydrates. |
| `svelte` | 5.57.2 | MIT | `svelte/server` `render(Component, { props, idPrefix })` → `{ head, body }` (sync, or awaitable with async flags); client `hydrate` / `mount` / `unmount`; `createRawSnippet` for HTML snippets. |
| `solid-js` | 1.9.17 stable; 2.0.0-rc.13 in repo benches | MIT | 1.x `solid-js/web` `renderToString` / `renderToStringAsync` / `hydrate` / `generateHydrationScript`; 2.0 rc exports only `.`, `./internal`, … (the web layer moves out of `solid-js`). |
| `astro` | 7.3.8 | MIT | reference only (not a dependency). |
| `@astrojs/react` 7.0.1, `/preact` 6.0.6, `/vue` 7.0.3, `/svelte` 9.0.1, `/solid-js` 7.0.2 | | MIT | read as the behaviour reference; no code copied (clean-room, same stance as HeroUI Pro). |
| `@qwik.dev/react` | 2.0.0-rc.2 | MIT | peer React `^18` only (no 19 yet). |
| `vite` (repo) | 8.3.2 | MIT | rolldown. Framework plugins: `@vitejs/plugin-react`, `@preact/preset-vite`, `@vitejs/plugin-vue`, `@sveltejs/vite-plugin-svelte`, `vite-plugin-solid` 2.11.14 (in repo). |

### 2.2 Astro's renderer contract (what we keep, what we change)

- **Integration.** `addRenderer({ name, serverEntrypoint, clientEntrypoint })`. The server module exports `{ name, check, renderToStaticMarkup, supportsAstroStaticSlot }`.
  - `renderToStaticMarkup(Component, props, slots, metadata)` → `{ html, attrs }`. `slots` = `{ default, name… }` as **HTML strings**.
  - The client module = `(element) => (Component, props, slots, { client }) => void`.
- **Adapter detection.** Astro calls every renderer's `check` per component.
  - React's `check` renders the component inside a `Tester` wrapper and looks at the returned vnode's `$$typeof`. Preact's and Solid's `check` render it too. Svelte checks `Component.toString()` for `$$payload` / `$$renderer`. Vue looks for `ssrRender` / `setup`.
  - So an unknown component is server-rendered up to N times per request. Same-extension frameworks (React + Preact + Solid `.jsx`) need `include` / `exclude` filters.
  - **We drop `check`.** The adapter is known at build time from file ownership (§4.1).
- **Directives.**
  - `client:load` → hydrate at page load.
  - `client:idle` (`{ timeout }`) → `requestIdleCallback`.
  - `client:visible` (`{ rootMargin }`) → `IntersectionObserver`.
  - `client:media="(q)"` → when the query matches.
  - `client:only="react"` → no SSR; needs the framework name; `slot="fallback"` shows while loading.
  - Custom: `addClientDirective` = `(load, opts, el) => …`.
  - No directive = static HTML, no JS.
  - Directives work only on statically imported components, not on dynamic tags.
- **Props.**
  - Hydrated islands accept only these types: plain object, number, string, Array, Map, Set, RegExp, Date, BigInt, URL, `Uint8Array` / `Uint16Array` / `Uint32Array`, Infinity.
  - **Functions are not supported**: they work during SSR only.
  - Render props do not work (use named slots).
- **Slots.**
  - Slots arrive as HTML strings wrapped in `<astro-slot>` (hydrated) or `<astro-static-slot>`.
  - React / Preact / Solid get them as props (`kebab-case` → camelCase, `children` for default) through a `StaticHtml` component that renders `dangerouslySetInnerHTML` and never updates.
  - Svelte 5 gets them through `createRawSnippet`, Vue through `h(StaticHtml)` slot functions.
  - The client walks `astro-slot` elements and stops at nested `astro-island`s.
- **Ids.**
  - Every renderer gets a per-request incrementing prefix: React `identifierPrefix`, Vue `app.config.idPrefix`, Svelte `idPrefix`, Solid `renderId` + `generateHydrationScript`.
  - Without it, `useId` / `$props.id()` collide between islands.
- **React specifics** (`@astrojs/react` 7.0.1):
  - SSR uses `renderToReadableStream` and reads it to a string after completion. It falls back to `renderToPipeableStream` (`onAllReady`), or to `renderToString` when `experimentalDisableStreaming` is set.
  - React 19 hoists `<link rel=preload|stylesheet…>` into the output; Astro strips them with a regex.
  - Hydration = `hydrateRoot(el, vnode, { identifierPrefix, formState })` inside `startTransition`. `client:only` = `createRoot().render`.
  - Re-render (HMR / prop change) calls `root.render` again; `astro:unmount` → `root.unmount()`.
- **Svelte 5** keeps `$state(props)` and `Object.assign`s new props (`setProps`). **Solid** keeps `createStore(props)` and `reconcile`s new props. These are the update paths we reuse for live props.
- **Preact** serializes Preact signals in props (`data-preact-signals`) and restores them, so a signal passed between two islands stays shared. This is the only framework-native cross-island state in Astro.
- **`transition:persist`**: an element / island keeps its DOM and state across ClientRouter navigations when the next page has the same `transition:name` / persist id. `transition:persist-props` keeps the old props.
- **`server:defer`** (server islands): render later on request. Rivet already has `Async` / `Suspense` streaming for this; out of scope.

### 2.3 Qwik `qwikify$` (`@qwik.dev/react`)

- `qwikify$(ReactCmp, { eagerness })` wraps React SSR (`renderToString`) + `hydrateRoot` into a Qwik component. Per-use directives: `client:load | idle | visible | hover | signal={sig} | event="click" | only`.
- **Not interactive by default.** An island whose props change re-renders (hydrates) when they change: "hydrate on prop change", the `QDisplay` example. We adopt this (§3.5).
- Each instance is an isolated React app: styles duplicated, no shared state, no inherited context. Qwik's guidance: "build wide islands, not leaf nodes". We repeat that guidance.
- `onClick$` props become lazy QRL handlers. That is async, and the event has already happened when the handler runs. Our Function Bridge calls are **sync** once the chunk is in (§3.6).
- `host:` listeners on the wrapper element.

### 2.4 Solid / Svelte interop notes

- SolidStart and SvelteKit have no foreign-island story; Astro is the reference implementation for both.
- Solid hydration needs the island's `renderId` and the `_$HY` bootstrap from `generateHydrationScript()` once per page.
- Solid 2.0 changes the package layout (web layer out of `solid-js`); the adapter ships for 1.9 first.
- Svelte 5 `hydrate` must get exactly the props `render` got (snippets included), or it throws `hydration_mismatch` and falls back to a client re-mount. Async SSR (`experimental.async`) returns a thenable from `render`.

## 3. Architecture

```text
Rivet .tsx  ──import──▶  Counter.react.tsx (owned by @vitejs/plugin-react)
     │                         ▲
     │ resolveId (Rivet importer + foreign target)
     ▼                         │ (foreign importers get the real module)
\0rivet-island:src/Counter.react.tsx  (generated facade, Rivet-compiled, resumable)
     │  export const default = (props) => _island(props, ISLAND)   // per export
     ▼
@rivetjs/bridge (core: _island server/DOM, protocol, slots, policies, persistence)
     │
     ├── server: adapter.render(Component, props, slots, ctx) → html | Promise<html>
     └── browser: clientEffect(when) → import(island chunk) → adapter.hydrate / update / unmount
                                         │
                @rivetjs/bridge-react | -preact | -vue | -svelte | -solid  (peer deps)
```

### 3.1 Packages

| Package | Contents | Deps |
| --- | --- | --- |
| `@rivetjs/bridge` | `.` types + `island()` escape hatch; `/server` `_island` (server); `/dom` `_island` (DOM, client-only islands + client renders); `/client` hydration driver (lazy chunk); `/vite` `bridge()` plugin (facades, ownership, manifest, HMR); `/adapter` adapter contract types + `defineAdapter`; `/persist` navigation persistence (pay-per-use) | peer `@rivetjs/runtime`, `@rivetjs/reactivity`, `@rivetjs/compiler` (vite), `vite` |
| `@rivetjs/bridge-react` | `server.ts`, `client.ts`, `vite.ts` (`react()` = `bridge` adapter entry + include rules + `@vitejs/plugin-react` composition), `types.d.ts` (JSX augmentation) | peer `react` `>=19.0.0 <20`, `react-dom` same, `@vitejs/plugin-react` `>=6.0.0 <7` (optional; 6.x = the Vite 8 line, T1); dev exact 19.3.0 |
| `@rivetjs/bridge-preact` | same layout | peer `preact` `>=10.29.0 <12`, `preact-render-to-string` `>=6.7.0 <7`, `@preact/preset-vite` (optional) |
| `@rivetjs/bridge-vue` | same + `.vue` SFC ownership | peer `vue` `>=3.5.0 <4`, `@vitejs/plugin-vue` |
| `@rivetjs/bridge-svelte` | same + `.svelte` | peer `svelte` `>=5.20.0 <6`, `@sveltejs/vite-plugin-svelte` |
| `@rivetjs/bridge-solid` | same | peer `solid-js` `>=1.9.0 <2`, `vite-plugin-solid` `>=2.11 <3` (Solid 2: separate adapter once 2.0 is stable) |

- Every package: `sideEffects: false`, own CLAUDE.md, `rivet.source: true` for `@rivetjs/bridge` (its `.tsx` resume symbols are user-visible captures, same as kit).
- Adapters never import each other. The core never imports an adapter statically; the generated facade imports exactly one.

### 3.2 Adapter contract

```ts
// @rivetjs/bridge/adapter
export interface IslandContext {
  id: string;                // per-request island id ("i3"), = framework id prefix ("r3-")
  nonce: string | undefined; // CSP nonce of the Rivet render (React / Solid inline scripts)
  signal: AbortSignal;       // request abort
  slot(name: string): SlotMark; // placeholder the adapter renders where Rivet content goes
}
export interface SlotMark { readonly name: string; readonly html: string } // `<rivet-slot name="x"></rivet-slot>`
export interface ServerAdapter<C = unknown> {
  name: "react" | "preact" | "vue" | "svelte" | "solid" | (string & {});
  /** HTML of the island's content (no wrapper). Sync when the framework can; a Promise otherwise (Vue, React streams). */
  render(component: C, props: Record<string, unknown>, slots: Record<string, SlotMark>, ctx: IslandContext): string | Promise<string>;
  /** Once per page, before the first island of this adapter (Solid `_$HY` script). Optional. */
  head?(ctx: IslandContext): string;
}
export interface ClientAdapter<C = unknown, H = unknown> {
  hydrate(root: Element, component: C, props: Record<string, unknown>, slots: Record<string, Node[] | null>, ctx: { id: string }): H | Promise<H>;
  /** client-only islands (and re-mount after a hydration error) */
  mount(root: Element, component: C, props: Record<string, unknown>, slots: Record<string, Node[] | null>, ctx: { id: string }): H | Promise<H>;
  update(handle: H, props: Record<string, unknown>): void;
  unmount(handle: H): void;
}
```

- `check` is gone (§2.2). The facade binds the adapter.
- Slots are `Node[]` on the client: Rivet-owned nodes are adopted, not re-parsed (§3.7).
- `update` gets the full prop snapshot. The adapters diff it the native way:
  - React: `root.render(createElement(C, props))` inside `startTransition`, unless the update came from a sync user event: then direct, so input stays controlled;
  - Preact: `render(h(C, props), root)`;
  - Vue: a `shallowReactive` props object;
  - Svelte: a `$state` proxy + assign / delete;
  - Solid: `createStore` + `reconcile`.

### 3.3 Island protocol (server)

- **Facade.** For each component export `X` of a foreign module imported by a Rivet-owned module (§4.1), the facade exports `X = (props) => _island(props, ISLAND_X)`.
  - Server variant: `ISLAND_X = { id: "<moduleId>#X", c: XImpl, a: reactServer }`.
  - DOM / symbol variant: `{ id, load: () => import("\0rivet-island-client:<moduleId>#X") }`.
  - The facade is a virtual `.tsx` module compiled by the Rivet compiler in resume mode. It joins `resume.modules` through the bridge plugin. Its `load` arrow is a captured inline function (`_rFn`), so the hydration effect resumes it.
- **Output** (`_island` server):

  ```html
  <rivet-island data-ri="i3" data-rf="react" [data-rc="visible"]><!--framework HTML with slot holes--></rivet-island>
  ```

  - `rivet-island` / `rivet-slot` get `display: contents` from one inline `style` attribute on each. There is no `<style>` element: CSP `style-src` stays as the app set it, and the per-element cost is measured in T4 (≈ 26 B / island raw, ≈ 0 compressed after the first).
  - `data-ri`: per-request island counter (shared with the framework id prefix, so `useId` never collides).
  - `data-rf` / `data-rc`: dev builds only (devtools + debugging); prod writes only `data-ri`.
- **Framework HTML.** `adapter.render` returns a string. The bridge splits it at the `SlotMark` placeholders and writes `[_markup(part0), slotContent0, _markup(part1), …]` into the Rivet stream:
  - Rivet children render **in place, as Rivet server values**: their resume records, markers, `data-r` ids and handlers are written in stream order, exactly as outside an island;
  - no Rivet content is ever rendered to a string and re-parsed.
- `_markup(html)`: new runtime ABI, a branded **trusted markup** server value (`@rivetjs/runtime/server-markup`, pay-per-use). Rivet has no user raw-HTML sink by design ("Unsafe or unsupported native attribute: innerHTML"). `_markup` is underscore ABI: only the bridge calls it (the framework renderers escape their own output). It stays undocumented for apps; language-core flags a user import (RV2143).
- **Async renders** (Vue `renderToString`, React when the tree suspends, Svelte async):
  - `_island` returns an `Async`-like boundary (`server-async.ts` contract);
  - inside a `Suspense` that streams, the island becomes a **segment** (`<template data-a>` + `data-patch` state + `$rA`) and its state entries go into that segment's patch (same path as every async content: `stream.defer`);
  - outside one, the shell awaits it (same as an awaited `Async`).
  - React: `renderToReadableStream(…, { identifierPrefix, nonce })` read to completion. A sync `renderToString` fast path is used when the adapter's probe sees no suspension: React marks it `allReady` synchronously. T4 measures `renderToString` vs stream-to-string per island.
- **Head output** (React 19 hoistables `<link>` / `<meta>` / `<title>`, Svelte `head`, Vue teleports to `head`): collected per island and forwarded to `@rivetjs/kit` head (`mergeHeads`) when the island renders in the shell. In segments they are dropped with a dev warning. Never regex-stripped silently as in Astro.
- **Resume state per island.** The island is a Rivet component, so its own captures go through the normal recorder:
  - one `clientEffect` (`_rEffect`) when a `client` policy is set (§3.5);
  - its captures: `load` (`_rFn` recipe), the root `ref()`, the props object (`_rProps` recipe: live getters stay live), `slots` presence, policy options;
  - static islands with no live props write **nothing** to the state (0 B).
- **Props encoding** = Rivet resume-format, not Astro's list. It covers JSON, Date, URL, Map, Set, BigInt, RegExp, URLSearchParams, binary, Error, class instances (Function Bridge `_rClass`), `let` cells and functions. Fewer refusals than Astro, checked at compile time (§7).

### 3.4 Island root markers + nesting

- **Root.** `rivet-island[data-ri]` is the hydration root (React `hydrateRoot(root)`, Vue `mount(root)`, Svelte `hydrate({ target: root })`, Solid `hydrate(fn, root, { renderId })`, Preact `hydrate(vnode, root)`). It holds only framework output + slot holes.
- **Slot holes.** `rivet-slot[name]` elements (default `name` omitted) are rendered by the adapter's `Slot` component:
  - React / Preact: `<rivet-slot dangerouslySetInnerHTML={{ __html: "" }} suppressHydrationWarning />`, memoized, never updated by React;
  - Vue: a `StaticHtml` render function;
  - Svelte: `createRawSnippet` returning `<rivet-slot></rivet-slot>`;
  - Solid: `ssr()` / a ref'd element.
  - On the server the hole is empty and Rivet writes the slot content into it.
  - On hydration the framework sees the same empty hole and leaves the children alone (React and Preact keep the DOM and do not patch `dangerouslySetInnerHTML` mismatches; T5 / T8 / T9 / T10 tests assert this per adapter).
- **Nesting.** An island inside a slot is a sibling Rivet component in the Rivet tree. Its root is inside the outer island's DOM, but no framework owns it:
  - an inner island hydrates independently, under its own policy, and may hydrate before the outer one;
  - when the outer island re-renders (update), the slot hole is stable, so the inner island survives.
  - Test: React(outer) › Svelte(inner) › Rivet button.
- **Unmount.** When the Rivet owner of an island is disposed (`Show` branch false, route left, `For` row removed), `onCleanup` → `adapter.unmount(handle)`.
- **Client-created islands** (an island inside a `Show` branch first rendered in the browser; client navigation to a page): `_island` (DOM) creates the root and calls `adapter.mount`. These islands never have SSR HTML, and the `client` policy still gates the load. A `static` island rendered on the client = the facade fetches the framework and mounts it once. Documented: put static content outside client-only branches, or use `client="load"`.

### 3.5 Client policies → Rivet preload + `clientEffect`

| `client=` | Rivet hydration trigger (`_rEffect` `when`) | Chunk preload (planner strategy) | Astro / Qwik equivalent |
| --- | --- | --- | --- |
| (none) | none; static HTML. With live props: hydrate on the first prop change (§3.6) | none (props case: bridge driver at idle, island chunk on change) | no directive / Qwik default |
| `"load"` | `when: "load"` (idle boot, or first delegated dispatch) | `e` (after first paint) | `client:load` |
| `"idle"` | `when: "idle"` | `i` | `client:idle` |
| `"visible"` | `when: "visible"`, observed element = island root's first element child (`display: contents` roots have no box) | `v` / `P` (background budget, `preload.background`) | `client:visible` |
| `"media:(q)"` | `when: "media:(q)"` | at match (`x` until then) | `client:media` |
| `"interaction"` | `when: "interaction"` (first pointerdown / keydown on the document) | `intent` | Qwik `client:event` (document-wide) |
| `"intent"` | island-local: pointerover dwell / focusin / touchstart **on the island root** → load + hydrate, then replay the triggering event | `intent` (loader's own prefetch) | Qwik `client:hover` |
| `"only"` | no SSR. `when: "load"`; renders `fallback` (Rivet content) on the server | `e` | `client:only` (framework name implied by the facade) |

- **Options** use one object form, `client={{ on: "visible", rootMargin: "200px" }}` / `{ on: "idle", timeout: 500 }`. The string form is shorthand.
- **`preload`** prop: optional; a stronger fetch than the hydration trigger (`client="visible" preload="idle"` = fetch at idle, hydrate when visible). Same values as the existing `preload` directive. Precedence: the existing order (element > component level > rules > automatic, `docs/guides/resumability.md` "Preload").
- **Runtime changes, all pay-per-use:**
  - `dom-resume` `when("visible")` observes element children when the target's computed `display` is `contents` (T3);
  - new recorder hook `_rPreload(chunkKey, strategy, ids)` (`server-resume.ts`): the bridge registers the island chunk (manifest `lazy` key of the facade's dynamic import) with the planner, so `visible` islands join the background budget and `load` islands get `e`. Loader unchanged (0 B: existing `e/i/v/P` codes).
- **Framework runtime chunk.** The island chunk statically imports the component module + adapter client. The framework runtime (`react-dom/client`, `vue`, …) is a shared chunk in its manifest `deps` closure, so two React islands share one copy. The planner's `sizes` / `deps` already count shared chunks once per page (PRELOAD-VISIBLE).
- **Cold events before hydration.**
  - Rivet handlers *around* an island resume as usual.
  - Events *inside* a not yet hydrated island are not replayed (same as Astro), except `client="intent"`: the triggering pointerdown / click is replayed after hydration (Qwik-style), using the loader's cold event snapshot.
  - Documented in the client-policy table (docs §6).

### 3.6 Live props + hydrate-on-change

- **Server.** Props are eager values. The resume recorder keeps the `_rProps` recipes: a prop written `count={count()}` is a getter reading `count`.
- **Browser, after hydration.** The driver runs `effect(() => adapter.update(handle, snapshot(props)))` under the island's owner:
  - `snapshot` reads every prop key (tracking), skipping `children` and slot props;
  - the first run is skipped (hydration used the same values);
  - updates are batched by Rivet's scheduler, so one Rivet batch = one `update` call per island.
- **Static island with live props** (no `client`):
  - the bridge records an idle `clientEffect` (bridge driver chunk only, ≈ 1 KB br target) that tracks the props without loading the framework;
  - on the first change it loads the island chunk, hydrates with the **old** values (the DOM matches them), then `update`s with the new ones;
  - this is Qwik's "hydrate on prop change", with no hydration mismatch.
- **Signals as values.** Passing a `Signal` / accessor *function* as a prop value (`count={count}`) is a callback, not a live value (§3.7). Typed props catch the mismatch (React expects `number`). The docs show `count={count()}`.

### 3.7 Callbacks out (Function Bridge) + event batching

- **Function props.** A function prop (`onChange={(n) => set(n)}`, `onSelect={select}` imported, a local const) resumes through the existing Function Bridge:
  - inline arrows / local consts → `_rFn` recipe;
  - imported / module functions → `_rMod`.
  - Non-resumable functions (built at module level into an object, Function Bridge T20 gap) → the compile / render error the Function Bridge already gives, naming the prop.
- **Wrapping.** The driver wraps every function prop once per island: `(...a) => _dispatchCall(fn, a)` = reactivity `batch` around the call, plus `onError` reporting through the island's error path. So React's `onChange` → Rivet signal writes → Rivet DOM updates flush synchronously at batch end.
  - The first-click deferral (`_dispatch` MessageChannel flush) is *not* applied: the wrapper uses `batch`, not `_dispatch`. React has already painted its own update by then; deferring Rivet's would split one interaction into two frames. Measured in T7.
- **Return values** pass through (sync). Promises pass through.
- **Event delegation.**
  - React 17+ listens on the root container (`rivet-island`); Vue / Svelte / Solid / Preact listen on elements (Solid delegates some events on `document` with `$$click` expandos, which do not clash with Rivet's `"$$" + type` keys: Rivet stores handlers under `$$click` too!). **Collision:** Solid's delegated `$$click` property on an element inside a Solid island vs Rivet's `_on` `$$click` key.
  - Rivet only reads `$$type` on elements it bound, but the dom-v2 `delegate` walk reads `node["$$click"]` on every path node. A Solid element would run Solid's handler from Rivet's dispatcher, and Solid would run it again.
  - Fix in T10: Rivet's dom-v2 key becomes a module `Symbol` / prefixed string (`"$r" + type`), measured on krausest. Otherwise the Solid adapter compiles with `delegateEvents: false` (vite-plugin-solid option). Decide by measurement.
- **Propagation.** `stopPropagation` inside a React handler stops the native event at the root container, so Rivet's document-level delegated handlers above the island do not run. That matches native semantics; documented.

### 3.8 Children + named slots

- `children` → the default slot. Named slots use Rivet's existing slot syntax: `<h2 r:slot="title">` on a child of the foreign tag compiles to a `title` content prop (compile-time slots, no browser code).
  - The bridge treats every prop whose value is Rivet content (`_slot` brand / JSX value) as a slot.
  - Name mapping: React / Preact / Solid get camelCase props, Vue / Svelte keep the name (Astro's rule, so Astro components port 1:1).
- **Server.** The adapter renders the hole; Rivet writes the content in place (§3.3).
- **Browser.**
  - Hydrated island: the slot hole already holds the resumed Rivet DOM, which stays Rivet-owned (its bindings, handlers and regions keep working).
  - Client-mounted island: `_island` (DOM) renders the slot content into a fragment under the island's owner and passes `Node[]` to the adapter. The adapter's `Slot` appends them into its hole in a ref / layout effect. Rivet keeps ownership and disposes them on unmount.
- **Scoped slots / render props** (`Slot<A>` with arguments): not in v1. They would need the foreign framework to call Rivet render functions with framework data. Use callbacks + live props instead. Diagnostic RV2142.

### 3.9 Errors + fallback

- **Server.**
  - `adapter.render` throws → the nearest Rivet `ErrorBoundary` handles it (segment fallback path included).
  - Without a boundary, the island renders its `fallback` prop when given, else the error propagates (dev: overlay with `[rivet:bridge] RV2144 React island src/Counter.react.tsx#default failed to render: …`, code frame of the Rivet call site via `appFrames`).
- **Browser.**
  - hydration throws / framework reports a recoverable mismatch (React `onRecoverableError`, Svelte `hydration_mismatch`) → dev warning naming the island; React re-renders client-side by itself; other adapters fall back to `mount` after clearing the root (slot nodes moved out first, re-attached after);
  - an `update` throw → reported through the island owner's error handler (`ErrorBoundary` on the client).
- The island chunk failing to load (skew, offline) → the root stays static HTML, dev + `console.error` once. Same fail-safe as the Function Bridge's missing-symbol path.

### 3.10 Persistence across router navigations

- **Layouts.** Islands inside a persisted layout already survive client navigation: the layout's DOM and owner are kept (`_rivet_keep`).
- **`persist="key"` prop** (Astro `transition:persist`, opt-in) for page-level islands. Pay-per-use module `@rivetjs/bridge/persist`, loaded only when an island uses `persist`.
  - When the router disposes a page, a persisted island's root element + framework handle are parked in a detached fragment instead of unmounted; the module hooks `@rivetjs/router/client` `onNavigate` / leave.
  - When the next page renders an island with the same key and the same component id, the parked root replaces the new placeholder and `update` gets the new props. `persist-props` mode keeps the old props.
  - Unclaimed parked islands unmount after the navigation commits.
  - With View Transitions on (`/transitions`), the parked root keeps its `view-transition-name`.
- **SSR document loads** (full reload) never persist, same as Astro.

### 3.11 Devtools

- `@rivetjs/devtools` tree shows each island as a node `⟨React⟩ Counter`, using the framework name as text, no glyph icons (lucide `component` icon). Fields: id, policy, state (`static | waiting | loading | hydrated | error`), hydrate ms, chunk bytes, prop snapshot (live props marked), slot count.
- "Hydrate now" action for waiting islands.
- Updates log: `update` calls with changed keys.
- Dev builds only (`data-rf` / `data-rc` attrs + a `__rivetBridgeDev` hook registered by `/client` in dev). Prod: 0 B.

### 3.12 Islands-only lean client (T7b, as landed 2026-10-12)

- **Problem (T7).** An island hydrates through a Rivet `clientEffect` (`root.tsx` `_hydratedRoot`), so a page whose only resumables are islands still booted the resume loader + entry + reactivity + DOM runtime + one chunk per facade / island / symbol: 16 JS requests and ≈ 25 KB gzip over Astro before input.
- **Decision (approach B, hybrid).** Exact, per render, at the end of the shell. No build-time proof, no manifest flag: the same build manifest serves both tails, so a route switches tails with its props (a non-JSON prop on one request, JSON on the next).
  - `_island` (server) offers each hydrated island to a per-render collector (`lean.ts` `offerLean` → runtime `_rLean`).
  - The runtime's tail hook asks the collector first: `recorder.lean?.tail(recorder) ?? encodeState(recorder)`.
  - Lean iff: every recorded resumable is an island's own `_hydratedRoot` effect (no Rivet handler / binding element, text binding, region, other client effect, client event, streamed boundary, error-boundary link, path plan; `For` row lists alone do not count), every island has a policy (no hydrate-on-change), no slot holds Rivet content, no `intent` (cold-event replay is the full driver's), every framework prop is a plain JSON value (no getter reading a signal = live prop — a getter that reads none, e.g. `rows.map(…)`, `t("x")`, is evaluated under `_trackReads` and sent as its value (caveat: a read inside `untrack(…)` is invisible, so that prop is sent as a constant); no function = callback, no `Date` / class / `undefined` in arrays / non-finite numbers), and `manifest.islands` maps every island key to a chunk URL.
  - Anything else → full driver, unchanged. Dev: one `console.info("[rivet:bridge] full resume driver for this page: <why>")` per distinct reason, naming the island id, key and prop (or the resumable counts). File-router pages: see D-lean below.
- **Lean tail.** `<script type="rivet/islands">[[id, url, props, on, prefetch?], …]</script>` (`prefetch` = chunk + manifest `deps`, the framework vendor; every policy except `interaction` / `media:`; no `<link rel="modulepreload">` tags since the LCP fix of 2026-10-13: server-side preloads of the `load` chunks at high priority put them on Lighthouse's simulated FCP / LCP path) (JSON, `<` / U+2028 / U+2029 escaped), then an inline classic `<script>` boot (`boot.ts`, minified into `boot.min.ts` by `build-boot.ts`: 1,705 B min / 957 B gzip / 790 B br). JSON props: shared sub-objects arrive duplicated (identity lost), top-level `undefined` keys are dropped, a nested `undefined` keeps the full driver. CSP nonce on every element. No state script, no resume loader, no Rivet runtime chunk.
- **Boot = the full driver's behaviour without Rivet.** Policy triggers mirror `dom-resume` `when` (load / idle / only at idle, `interaction` = document pointerdown / keydown, `visible` over ≤ 48 boxes of the `display: contents` root, `media:`); records carry the chunk + its `deps`, modulepreloaded once at idle after the first paint (`visible`, user ruling 2026-10-27 / BRIDGE-FIX E4: modulepreloaded once a box is within one viewport, observer `root: document` + rootMargin `100% 0px`, hydrated once a box intersects; a `visible` island the boundary hydrates gets a prefetch-only record, `props` null) (the first `paint` performance entry → `requestIdleCallback`; the planner's `i` / `P` schedule), each link with the boot script's CSP nonce. Every trigger's `import` waits for that paint too (an in-viewport `visible` island intersects before it). Paint-gate fallbacks so an island always mounts: no `paint` entry type (or no `PerformanceObserver`) → the idle slice alone; a page that never paints contentfully (hidden until an island reveals it, an empty `only` shell, a 0×0 iframe; Safari / Firefox emit only `first-contentful-paint`) → 1 s after `load` at the latest; a first pointerdown / keydown opens the gate at once (`interaction` islands mount immediately, the rest with them); a hidden tab / prerender waits for its paint or the cap. `import(url)` → the chunk's `adapter.hydrate(root, default, props, {}, { id })`; hydrate throws → clear + `mount` (full driver: same, dev warning); `only` → clear the fallback + mount. Chunk / start failures: one `console.error` each, same texts as `client.ts` in production. React recoverable errors still go through `islandRecovered` (RV2149, adapter code).
- **D-lean: file-router pages (2026-10-12, DEMO lane; was the plan follow-up "lean client + router navigation").** A file-router page records the `Router` region + the router's `intent` client events (link click / pointerover / focusin, popstate). They no longer block the lean tail:
  - The runtime hands the provider a `DeferredState` (`tail(view, deferred)`): the state script + resume loader of the other resumables, encoded without the lean islands' effects and `_rPreload`s, as a lean, non-booting page (no `data-boot`, no schedule). `null` when the rest would boot at load (client effects, eager client events, regions that mount) → full tail. Tail order: island records + boot, then state + loader.
  - Islands hydrate exactly per their `client` policies (no nav intent needed). Only Rivet's navigation waits: the loader starts the runtime on the first link pointerover dwell / focusin / touch / click; a cold click is held and replayed (one navigation, test `lean-deferred-browser`); keyboard Tab → Enter = focus intent.
  - Fetch-ahead policy (coordinator ruling (c)): render option `preload.ahead` keeps the deferred state's `data-fo` (runtime + router chunks + deps as `fetchpriority=low` modulepreloads after `load`, the web fonts, the first paint entry (none without the entry type; 1 s cap) and an idle slice; fetched and compiled, never evaluated — test counts module evaluations). The router sets it while document prefetch is on (`rivetRouter({ prefetch })` → generated `fetchAhead` → `createApp` `preload.ahead`, overridable). Off (no document prefetch): nothing before intent, and the first client navigation pays the runtime fetch (apps/bridge-demo, Fast 3G, 1 sample: nav click → next route painted 3.2 s vs 1.7 s Next / full driver).
  - Known cost: React roots of the first page's lean islands are not unmounted when a client navigation replaces their DOM (one page's islands, once per document).
  - Measured: `docs/benchmarks/2026-10-12-bridges-demo.md` (apps/bridge-demo; smoke before the timed run: JS executed before input 94.3 KB gzip on `/orders` vs 124.8 full driver vs 162.3 Next).
- **Grouping not needed.** The ≤ 3 cold JS requests target holds without ChunkGroup / `groupComponents()`: the boot is inline, an island chunk statically imports its component + adapter, the vendor is one shared chunk. Bench page: `Counter` island chunk (398 B) + React vendor (221 KB raw) at load, `Picker` (627 B) at idle; `Chart` (606 B) prefetched at idle, hydrated when visible.
- **Cost without islands.** Runtime: one optional property read per resumable render, +91 B min in `server-resume` (server only); 0 B in every client bundle. `@rivetjs/bridge/server` grows by the boot string + collector (4,267 → 9,089 B min, server only).
- **Later optimisation (A).** A compiler (Rust) static proof per route ("no Rivet resumable reachable") could drop the render-time recorder work on such routes. Not needed for the bench result; parked in the plan.
- **Measured** on a bare `resumableToString` page (no file router; router pages: D-lean, above) (`docs/benchmarks/2026-10-12-islands.md`, T7b run, loaded host, interleaved with the full-driver baseline lane): bytes before input 78.6 KB gzip est. vs 80.8 astro-react (TIE, 0.97×) vs 105.2 full driver; JS requests 4 (3 at load + the idle `visible` prefetch) vs 5 astro-react vs 16 full; hydration script CPU (Fast 3G + 4× CPU) 35.0 vs 46.1 astro-react vs 40.2 full; server CPU / page lean vs full TIE (0.23 vs 0.25 ms), 2.26× better than astro-react.

## 4. Build integration

### 4.1 JSX ownership (decision)

- **Decision: file conventions + explicit `include`, with the existing pragma rule as override. No content sniffing.**
  1. `.vue` → Vue, `.svelte` / `.svelte.ts` → Svelte (unambiguous, owned by their plugins).
  2. JSX frameworks:
     - `*.react.tsx|jsx` → React;
     - `*.preact.tsx|jsx` → Preact;
     - `*.solid.tsx|jsx` → Solid.
  3. `/** @jsxImportSource react|preact|solid-js */` leading pragma marks a file for that framework too. The Rivet plugin's `foreignJsxPragma` (T7 file selection) already leaves such files to other plugins; the bridge maps the pragma's package to the adapter.
  4. Adapter `include` / `exclude` (Vite `FilterPattern`) for folders or npm packages: `react({ include: ["src/react/**", "@mui/material", "@mui/x-date-pickers"] })`. npm packages are matched by **import specifier** (no file under `node_modules` is ever compiled as Rivet: the Rivet plugin already skips `node_modules` except `FRAMEWORK` packages).
  5. Everything else `.tsx` / `.jsx` = Rivet. A Rivet file that matches an adapter rule = build error RV2145 naming both rules.
- **Why not sniffing.** Astro's `check` (render to detect) costs server CPU per component, and Astro still needs `include` for React + Preact + Solid. Qwik needs the pragma. A suffix is visible in the file tree and in imports, and both Vite plugins can test it with a regex.
- Each framework's Vite plugin gets the same filter (`react({ include })` passes it to `@vitejs/plugin-react` `include`). The Rivet plugin gets it as `exclude`, so the two never both compile a file. The adapter's `vite.ts` composes the plugins in order: framework plugin, then `bridge()`, then `rivet()`. Users list one entry: `plugins: [rivet({ bridges: [react(), svelte()] })]`. Bridges are an option of `rivet()`, so ordering and the ownership filter are set in one place.

### 4.2 Facade resolution

- `resolveId(source, importer)`:
  - when the importer is Rivet-owned and the resolved target is foreign-owned (rules above, incl. npm specifiers), return `\0rivet-island:<target>?env=<server|client>`;
  - foreign importers (React importing React) get the real module.
- `load`: export names come from `this.load(target)` → `moduleInfo.exports` (rolldown) or an es-module-lexer pass on the transformed code. Default + named exports. For each export that may be a component (functions, classes, objects; type-only exports skipped), emit `export const X = (props) => _island(props, ISLAND_X)` as Rivet TSX. Non-component exports (constants, hooks) are re-exported unchanged, so `import { useThing }` in a Rivet file still works (server only; RV2146 warns when used in a browser symbol).
- **Types.**
  - TypeScript sees the real module (`ReactCounter: FC<P>`). Rivet's `JSX` namespace (`@rivetjs/runtime/jsx-runtime`, types only) gains `ElementType` widening (classes + objects for Vue / Svelte), plus `LibraryManagedAttributes<C, P>` = `C extends ForeignComponent ? IslandProps<C> : P`.
  - `ForeignComponent` / `PropsOf` come from an augmentable registry interface `RivetBridgeFrameworks`, which each `@rivetjs/bridge-*` package augments in its `types.d.ts`. React: `C extends ComponentType<infer P>`; Vue: `DefineComponent`; Svelte: `Component<P>`; Solid: `Component<P>`.
  - `IslandProps<C> = PropsOf<C> & { client?: ClientPolicy; preload?: Strategy; persist?: string; fallback?: Content }`.
  - 0 B; the TS plugin gets it for free.
- The escape hatch for dynamic choices (CMS block maps): `island(Component, "react")` from `@rivetjs/bridge` returns the same facade component at runtime (dynamic import id derived from a module-level `islands({...})` registry the plugin rewrites). Documented as advanced; the plugin flags non-literal uses.

### 4.3 Runtimes, SSR externals, dedupe

- Server: framework packages stay **external** in SSR builds (Node loads `react-dom/server` once). `ssr.noExternal` keeps `@rivetjs/*` only (unchanged).
- The bridge plugin adds `resolve.dedupe: [react, react-dom]` (per adapter), so a linked library cannot bring a second React.
- Client: `optimizeDeps.include` for the framework runtime entries (dev), so the first island does not trigger a re-optimize reload.
- React dev vs prod: `process.env.NODE_ENV` is defined by Vite. The server build uses React's production server build in prod (`react-dom/server.node` is selected by `NODE_ENV`).
- One framework per page: n islands share one runtime. Two frameworks = two runtimes, priced in docs §6 and reported per page in the build output (`[rivet:bridge] /dashboard: react 58.2 KB br, vue 0 KB`) and in `size-report`.

### 4.4 HMR

- Editing a foreign component: the framework plugin's HMR (React Fast Refresh, Vue / Svelte / Solid HMR) updates the island in place (the island chunk's module is a normal Vite module in dev; hydration goes through the real component module).
- The facade does not change unless the export list changes; then it invalidates the importing Rivet module (Rivet's own hot-replace).
- Editing the Rivet page around the island: Rivet hot-replace re-runs the component. Island handles survive when the island's owner is kept; otherwise the island unmounts and re-mounts from the current DOM (dev only, state lost, documented).

### 4.5 Prerender + static output

- `@rivetjs/router` static / prerender adapters: islands render at build time like any component. Hydrating islands need the island chunks in the client build, which they always are (dynamic imports from facades).
- `editorial-bench`-style zero-JS pages: static islands add 0 B JS.

### 4.6 Tooling

- **`create-rivet`**: a `--bridge react|preact|vue|svelte|solid` flag (multi) + prompt "Add a framework bridge?". It adds the dependency, the adapter in `vite.config.ts`, and one example island `src/components/Counter.react.tsx` used on the index page. Templates themselves stay bridge-free (zero-cost of starters).
- **`@rivetjs/nx`**:
  - `bridge-setup` generator: adds the adapter + deps + vite config;
  - `island` generator: `nx g @rivetjs/nx:island Chart --framework react --project web` → `Chart.react.tsx` + usage snippet + a test.
  - Migrations: none (new).
- **language-core / TS plugin:**
  - island prop diagnostics (§7);
  - "Go to definition" through the facade = TS default (real module);
  - route-links unaffected;
  - `rivet-check` CLI runs the same checks.
- **VS Code**: Rivet: Doctor reports bridge config problems (adapter installed, framework plugin present, peer versions in range).

## 5. API (final syntax)

### 5.1 Decision: the foreign component is the JSX tag (compiled sugar through the facade), not `<Island of={…}>`

```tsx
// src/routes/index.tsx  (Rivet)
import { signal } from "@rivetjs/reactivity";
import Counter from "../components/Counter.react";   // React 19 component
import Chart from "../components/Chart.svelte";       // Svelte 5
import { DatePicker } from "@mui/x-date-pickers";     // npm, listed in react({ include })

export default function Page() {
  const count = signal(0);
  return (
    <main>
      <Counter client="visible" count={count()} onChange={(n) => count.set(n)}>
        <p>Rivet content inside React — still resumable: <button onClick={() => count.set(0)}>reset</button></p>
        <span r:slot="label">Clicks</span>
      </Counter>
      <Chart data={series()} />                                   {/* static; hydrates on the first data change */}
      <DatePicker client={{ on: "idle", timeout: 500 }} value={date()} onChange={setDate} />
      <Counter client="only" fallback={<Skeleton />} count={0} />
      <Counter client="intent" persist="player" count={count()} />
    </main>
  );
}
```

- **Bytes.** Both forms lower to the same `_island(props, ISLAND)` call, so runtime bytes are equal. The facade binds the adapter at build time, which removes:
  - `<Island of>`'s runtime adapter lookup (a stamp `WeakMap` or an Astro-style `check`);
  - its per-call `of` capture.
  - Each facade export is ≈ 60 B min in the island's own chunk.
  - `<Island of>` would also need a per-component framework stamp in every foreign module.
- **DX.**
  - The same as Astro and Qwik: import and use; copy-paste examples from those docs work after renaming `client:visible` → `client="visible"`.
  - The `client` vocabulary is Rivet's existing `ClientWhen` (`"load" | "idle" | "visible" | "interaction" | "media:(q)"`) plus `"intent"` / `"only"`, so `clientEffect` and islands read the same.
  - No name clash: the chunk-grouping component is `ChunkGroup` (`@rivetjs/runtime/dom`; renamed from `Island`, ruling Q3).
  - Typed props come from the real component type (§4.2).
- **Diagnostics.** The island set is known statically: every JSX tag whose import resolves to a facade. That lets the Vite plugin and language-core check every island site (§7) with code frames at the Rivet call site. `<Island of={x}>` with a dynamic `x` would lose that; dynamic choice stays explicit through `island(C, "react")`.
- **Why `client="visible"` and not Astro's `client:visible`.** A namespaced attribute on a component would need compiler work in `rust/**`. It would also need the TS JSX namespaced attribute rules for typing, and it cannot carry options (`client:visible={{ rootMargin }}` is a second, differently typed prop). A string / object prop is typed by `IslandProps`, needs no compiler change, and lowers to the same thing. Rivet's own namespaced attributes (`r:slot`, `window:onX`) are compile-time constructs; `client` is runtime data.
- **Rejected: `<Island of={ReactCounter}>`.** It loses the static island set, needs runtime adapter detection, and reads like a component named after the protocol. Kept only as the `island()` escape hatch.

### 5.2 Config

```ts
// vite.config.ts
import { rivet } from "@rivetjs/compiler/vite";
import { rivetRouter } from "@rivetjs/router/vite";
import { react } from "@rivetjs/bridge-react/vite";
import { svelte } from "@rivetjs/bridge-svelte/vite";

export default defineConfig({
  plugins: [rivetRouter(), rivet({ bridges: [react({ include: ["@mui/x-date-pickers"] }), svelte()] })],
});
```

- `react(options)`:
  - `include` / `exclude` add to the `*.react.tsx` + pragma defaults;
  - `plugin`: options forwarded to `@vitejs/plugin-react` (`babel`, `jsxRuntime`), or `false` when the app adds the framework plugin itself (then the bridge only asserts it is present and uses the same filter).
- Per-adapter render options: `react({ server: { stream: "auto" | "string" } })`, `vue({ setup(app) {} })` (Pinia / i18n plugins per island app, Astro's `appEntrypoint`), `solid({ hydratable: true })`.

## 6. Perf

### 6.1 Cost model

- **Static island** (no `client`, no live props):
  - server: one `adapter.render` + one `_markup` write;
  - browser: 0 B JS, 0 state entries;
  - HTML overhead: `<rivet-island data-ri="iN" style="display:contents">` + `</rivet-island>` ≈ 60 B raw / ~5 B br after the first.
- **Hydrating island:**
  - state: one fx entry + captures (props table entries; live props add recipes);
  - JS: bridge driver (target ≤ 1.2 KB br) + adapter client (React ≤ 0.6 KB br) + framework runtime (shared per page) + component chunk;
  - CPU: framework hydration of that subtree only.
- **Framework runtime** (measured in T1, 2026-10-12: rolldown with the zero-cost config, minified, production, brotli q11; method + gzip column in `libs/bridge/CLAUDE.md` "Upstream costs"):

  | Runtime entry | min B | br B |
  | --- | ---: | ---: |
  | React 19.3.0 `createElement` + `react-dom/client` `hydrateRoot` (+ `createRoot`: +47 B br) | 220,229 | 58,241 |
  | Preact 10.29.8 `h` + `hydrate` (+ `preact/hooks` `useState`: 4,766 br) | 10,385 | 4,017 |
  | Vue 3.5.43 `createSSRApp` + `h` + `shallowReactive` | 67,456 | 23,299 |
  | Svelte 5.57.2 `hydrate` + `mount` + `unmount` (+ a compiled `$state` counter: 10,216 br) | 24,086 | 8,471 |
  | Solid 1.9.15 `solid-js/web` `hydrate` + `render` + `createSignal` | 9,205 | 3,274 |

- **Server CPU per island** (measured in T1: `ul > li > span` list, 2,000 renders × 5 alternating rounds, Node 26.5.1, bench lock, 1-min load 7–10 on 14 cores; median µs / render, KB allocated / render):

  | API | 51 elements | 501 elements |
  | --- | ---: | ---: |
  | React `renderToString` | 8.1 µs, 30.9 KB | 43.6 µs, 240.1 KB |
  | React `renderToReadableStream` → string | 20.2 µs, 38.7 KB | 98.5 µs, 231.0 KB |
  | Preact `renderToString` | 3.5 µs, 18.8 KB | 29.0 µs, 178.8 KB |
  | Vue `renderToString` (one `createSSRApp` per render) | 8.0 µs, 30.9 KB | 48.5 µs, 229.1 KB |
  | Svelte `render` | 3.5 µs, 8.9 KB | 13.0 µs, 48.2 KB |
  | Solid `renderToString` (hand-written `ssr()` templates) | 1.8 µs, 7.4 KB | 11.2 µs, 46.3 KB |

  - React stream-to-string = 2.3–2.9× `renderToString`: the sync `renderToString` fast path (§3.3) stays; streams only when the tree suspends.
  - Overhead target: bridge ≤ 3% of the framework's own render time for a 50-element island (≈ 0.24 µs React, ≈ 0.05 µs Solid).
  - Preact 11.0.1 and Solid 1.9.17 were not installable offline in T1 (10.29.8 / 1.9.15 measured); T8 / T9 re-measure on the pinned versions.

### 6.2 Benchmarks

- **New `apps/island-bench`** (not inside ssr-bench: those lanes are fixed-shape SSR pages hashed by zero-cost). Same page = header + 1000-row Rivet list + 3 React islands (counter `client="load"`, chart `client="visible"` below the fold, date picker `client="idle"`) + 1 static React island.
- **Lanes:**
  - `rivet-bridge-react`;
  - `astro-react` (Astro 7.3 + `@astrojs/react` 7.0, same components);
  - `next` (Next.js page, same components, RSC for the static parts);
  - `rivet-native` (the islands rewritten in Rivet: the ceiling);
  - later `rivet-bridge-vue|svelte|solid|preact` vs `astro-<same>`.
- **Metrics:**
  - server: CPU / page, TTFB p50, complete p50, peak RSS (ssr-bench harness: shared loadgen + `fair-report.ts` verdicts);
  - browser (resume-bench harness): bytes before first input, JS requests before first input, first-input-to-paint per island, hydration CPU (4× CPU throttle, Fast 3G), CLS, `firstInputSync`.
- **Targets:**
  - beat `astro-react` on TTFB / CPU / page (Rivet's SSR vs Astro's) and on bytes before first input (background budget, no Astro island runtime);
  - match it on hydration CPU (same React work);
  - beat `next` by ≥ 1.3× on server CPU and bytes. Losses get written up, not hidden (editorial-bench precedent).
- **Zero-cost:**
  - `scripts/zero-cost/check.sh` stays identical for every existing package;
  - new lines for `@rivetjs/bridge*` subpaths;
  - a new condition-parity entry for `/server` vs `/dom`;
  - a new **fixture app check**: a router app with one island page + one Rivet-only page; the Rivet-only page's HTML, state and preload list must equal the no-bridge build (byte compare) — T11.
- `size-report`: bridge driver, each adapter client, each framework runtime (informative, not gated).

## 7. Diagnostics

- New codes, registered in `codes.json` + `explain.json` with fixes:

| Code | Where | Message (shape) |
| --- | --- | --- |
| RV2140 | language-core (type-aware, warning) + server render (dev error) | `React island Counter: prop "count" is a Signal function, pass its value (count={count()}) or a callback` |
| RV2141 | language-core (warning) / render (error) | `Island prop "x" cannot be resumed: <reason from serializationProblem>` (WeakMap, Promise, stream, DOM node, foreign framework element like a React element as a prop) — only for hydrating / live islands; static islands accept anything (server only) |
| RV2142 | language-core | `Island Counter: slot "row" takes arguments; foreign islands get plain content (render props are not supported)` |
| RV2143 | language-core | `_markup is internal to @rivetjs/bridge` |
| RV2144 | server dev error | `React island src/Counter.react.tsx#default failed to render: <message>` + call-site frame |
| RV2145 | vite plugin | `src/x.tsx matches both the Rivet compiler and react({ include }) — pick one owner` |
| RV2146 | vite plugin (warning) | `Non-component export useThing from a React module used in browser code of a Rivet file` |
| RV2147 | vite plugin | `client="only" island Counter has no fallback and is above the fold (dev hint, warning)` |
| RV2148 | vite plugin (error) | `src/Chart.react.tsx is owned by react but uses the Rivet runtime (@rivetjs/runtime)` — value imports / re-exports / `import()` (type-only imports, comments, strings ignored) or the runtime's leading JSX pragma (T5 review F1, renumbered in T6 review M2) |
| RV2149 | adapter (browser, warning) | `react island i3 recovered from an error: <message>` — the framework re-rendered the island on the client (React `onRecoverableError`); `console.error` with the code, dev also a devtools error entry (`error.island` hook event, island root as element) |
| RV2150 | Preact adapter (server, error) | `Preact useId mask not applied (probe rendered <i>P0-0</i>): Preact island ids would not be unique …` — one-time probe on the first Preact island render (T8 review F4); every Preact island render then throws |

- Codes RV2140–2159 are reserved for the bridge (inside the resume range, since every check is a resume check).

## 8. Docs + tests

### 8.1 Docs (apps/docs)

- New section **Guides › Components › Use React, Vue, Svelte, Solid or Preact components** (`apps/docs/content/guides/components/framework-components.md`):
  - install + config;
  - file ownership;
  - `client` policies table (with Astro / Qwik equivalents);
  - props + live props;
  - callbacks;
  - children + named slots;
  - nested islands;
  - `persist`;
  - errors;
  - costs (per framework bytes table, "wide islands, not leaf nodes");
  - islands-only pages (§3.12: lean boot, what keeps the full driver, dev log line);
  - limits (no context crossing, no render props, cold events).
- Reference page `reference/bridge.md` (adapter options, `IslandProps`, `island()`, adapter contract for custom adapters).
- Examples in `apps/docs/examples/`: `bridge-react-counter`, `bridge-svelte-chart`, `bridge-mixed` (React + Vue + Svelte + nested), `bridge-persist`.
- Glossary: "Island" entry split into chunk group vs framework island.
- `learn/` page "Bring your React components" for migrations.
- `llms.txt` / `llms-full.txt` / per-page `.md` regenerated; MCP data, AI files (`libs/mcp/ai`: a "framework islands" rule for agents), skills, templates' AGENTS.md / CLAUDE.md (when create-rivet adds a bridge) — per the "docs follow code" rule.

### 8.2 Tests

- **Per adapter, node** (`libs/bridge-<fw>/tests/*.test.ts`):
  - SSR parity: island HTML = the framework's own `renderToString` output for the same props (byte compare inside the wrapper);
  - ids prefixed per island;
  - async render inside `Suspense` → segment;
  - slot holes;
  - head hoisting;
  - error → boundary.
- **Per adapter, Chromium** (`*.browser.test.tsx`, resume harness):
  - each policy hydrates only on its trigger (network log: no framework request before);
  - `visible` below the fold + background budget;
  - `media` toggling;
  - `intent` replay;
  - `only` + fallback;
  - live props update without re-hydrate (framework render count);
  - static island hydrates on first prop change, no mismatch warning;
  - callbacks write Rivet signals, sync DOM;
  - slot content stays resumable (Rivet handler inside a React slot works before and after React hydrates);
  - nested React › Svelte › Rivet;
  - unmount on `Show` false;
  - client-mounted island;
  - hydration mismatch recovery.
- **Router e2e:** `persist` keeps state across `navigate`; a layout island survives; Rivet-only page has no bridge bytes.
- **Zero-cost:** fixture app byte compare (§6.2); `packages-hashes` lines; dev-leak scan covers `data-rf` / devtools hooks.
- **Vite:** ownership matrix (suffix, pragma, include, npm specifier, RV2145), facade export list (default / named / re-export / type-only), HMR (framework edit keeps the Rivet page state; export-list change reloads the importer).
- **language-core:** RV2140–2149 fixtures + quick fixes (`count={count}` → `count={count()}`).

## 9. Risks

| # | Risk | Mitigation |
| --- | --- | --- |
| R1 | **Version churn** — React 19.x server APIs move (`resume`, `prerender`, hoistables); Solid 2.0 moves the web layer out of `solid-js`; Preact 11 changes internals; Svelte 5 minor releases change hydration markers | Peer ranges pinned to one major (`>=19.0.0 <20` …); adapters use only documented entry points (`react-dom/server`, `react-dom/client`, `svelte/server`, `svelte`, `vue/server-renderer`, `solid-js/web`, `preact-render-to-string`); CI matrix job per adapter at range floor + latest; Solid 2 = separate adapter after 2.0 final |
| R2 | **React 19 streaming SSR inside Rivet's stream** — `renderToReadableStream` emits inline `<script>` (`$RC` boundary swaps) and hoists `<link>`/`<title>`; inline scripts break `strict-dynamic` CSP without the nonce; reading to completion loses React streaming | Pass Rivet's nonce; read to completion per island (v1); when the tree suspends, the island itself streams as a Rivet segment (Rivet does the streaming, React does not); hoistables forwarded to kit head, never regex-stripped; measure `renderToString` fast path |
| R3 | **Svelte 5 runes hydration** — `hydrate` must get identical props/snippets or throws `hydration_mismatch`; slot snippets must render byte-identical holes | Snippets built by one shared function on both sides; tests compare server `render` body vs hydrated DOM; mismatch → `mount` fallback with slot nodes preserved |
| R4 | **Vue async components / `<Suspense>`** — `renderToString` is a Promise; async setup in islands means the shell waits unless inside Rivet `Suspense` | Async island = Rivet `Async` boundary (segment in `Suspense`); docs recommend wrapping data-loading Vue islands in `Suspense`; Pinia/i18n via `setup(app)` per island app |
| R5 | **Double runtime size** — React (≈ 58 KB br) next to Rivet; two frameworks on one page | Per-page bytes report at build; background budget only for `visible`; docs bytes table + "wide islands"; bench publishes it honestly |
| R6 | **Event delegation conflicts** — Rivet dom-v2 reads `"$$" + type` expandos on every path node; Solid uses the same `$$click` expandos → double dispatch; React stopPropagation at the root container hides events from Rivet document handlers; Rivet's batched `_dispatch` first-click deferral vs framework paints | Rename Rivet's key (measured on krausest) or compile Solid islands with `delegateEvents: false`; callbacks use `batch` not `_dispatch`; document propagation semantics; tests per adapter with a Rivet ancestor handler |
| R7 | **CSS scoping** — Vue/Svelte scoped CSS and CSS-in-JS (emotion/MUI) inject `<style>` at runtime, need nonces, and flash on static islands; Rivet `css`` sheets` unaffected | Collect framework CSS from the Vite build (Vue/Svelte emit CSS files, linked via manifest per island module, like Rivet styles); emotion SSR via adapter `render` hook (`extractCritical`) documented as recipe; nonce passed |
| R8 | Hydration mismatch from Rivet-written slot content (React sees non-empty holes) | Holes rendered with empty `dangerouslySetInnerHTML` + `suppressHydrationWarning`; tests in every adapter |
| R9 | Function Bridge gaps (T20: functions built at module level into objects) surface as island callback errors | Same diagnostic as everywhere; island docs show the inline-arrow form |
| R10 | Facade export detection fails for CJS / `export *` from npm packages | `export *` resolved via `moduleInfo`; CJS packages → explicit `exports` option `react({ include: { "@lib/x": ["Grid", "Cell"] } })`; error names the package |

## 10. Phase 2 sketch: reverse direction (Rivet inside React / Vue / …)

- `@rivetjs/bridge-react/embed`: `<RivetIsland component={Card} props={…} />` React component.
  - Server: renders the Rivet component through `renderToString` from `@rivetjs/runtime/server` and returns it as React `dangerouslySetInnerHTML`. The resume state script goes into a per-island state block (`createResume` scopes).
  - Browser: no hydration. Rivet's loader resumes the island root (multiple resume roots per document = new runtime work: today one state script per document plus segment patches).
- Props from React re-render the Rivet island through a signal-backed props object (live props).
- Value: Rivet components (cdk / ui) in Next.js / Remix apps. Needs: multi-root resume, React streaming integration, CSS delivery. A separate spec after v1 ships and measures.

## 11. Rulings 2026-10-12

- Q1 adapter order: React → Preact + Solid → Vue → Svelte (the plan's order stays).
- Q2 setup: docs-only setup first; a `create-rivet --bridge` flag lands in T15 only if it is a thin overlay.
- Q3 naming: YES. The chunk-grouping component `Island` is renamed `ChunkGroup` (`@rivetjs/runtime/{server,dom}`), `resume.chunks: "island"` → `"group"`, compiler module facts `islands` → `groups`. No alias (breaking changes allowed). "Island" means a framework island only.

## 12. Implementation notes (T3 server protocol, T4 client driver, T5 Vite integration, T6 React adapter, T8 Preact adapter, 2026-10-12)

Where the implementation differs from §3, the implementation is current (`libs/bridge/CLAUDE.md`):

- **Facade shape.** `_island(props, def, load)`: the loader is a third argument, a module-level named function (`function loadX() { return import(…) }`) used inside a JSX-returning component (`export function X(props) { return <>{_island(props, ISLAND_X, loadX)}</>; }`). It resumes by reference (`_rMod`). An inline arrow argument of a plain arrow component and a member of the module-level `ISLAND_X` object are not resumable (compiler resume extraction covers JSX-returning components; module-level objects are the Function Bridge T20 gap). `IslandDef` = `{ id, c?, a?, chunk?, head? }`: `chunk` = island chunk URL for `_rPreload`, `head` = head sink (kit `pushHead`, passed by the facade).
- **Root module.** `libs/bridge/root.tsx` (`_staticRoot` / `_hydratedRoot`): the root element and the hydration effect live in a module compiled for both targets; `server.tsx` holds the protocol only.
- **Head.** `ServerAdapter.render` may return `IslandRender` = `{ html, head? }`; `head` goes to `def.head` and is written before the root. Shell vs segment placement is the head sink's job (kit writes late entries as body markup); no sink → dev warning, dropped.
- **Error precedence.** The island's `fallback` wins over an enclosing `ErrorBoundary` (§3.9 lists the boundary first): the core cannot see a boundary above it. Without `fallback`, the RV2144 error reaches the boundary, else the render fails.
- **Slot holes in production.** A hole missing from the adapter output or written twice (a framework that normalised the mark's attributes) takes the island error path in every build: `fallback`, else RV2144 naming the island and the slot. Slot content is never dropped or duplicated silently.
- **`client="only"` and head.** No server render means no adapter page head (`adapter.head`, e.g. Solid's hydration script) for that island; head belongs to server-rendered output. The next server-rendered island of the same framework writes it.
- **Untracked `_island` (T4).** Both `_island` variants run untracked. The facade's `{_island(props, …)}` child would otherwise record a binding over every prop it reads, and a resumed page would re-create the island (a client mount over the server HTML) on the first prop change. Live props reach the browser only through the hydration effect's captured props.
- **Driver ownership (T4).** `hydrateIsland` keeps the brief's `void` signature: the root effect captures its owner and calls the driver through `runWithOwner`, so the live-props effect, the callbacks' error routing and `unmount` belong to the region holding the island. The effect's cleanup stops a driver whose chunk is still loading.
- **`intent` replay (T4, review fixes).** The driver records the first cold `pointerdown` / `click` on the island root (capture listeners from the idle start of the effect), not the loader's cold event snapshot (§3.5): on the derived model the island hole's boundary listens to every type, so the loader holds a press before boot and replays it onto the target after the adopt run; the driver records presses itself, synchronously (T-INTENT-COLD, DERIVED-GAPS 04). The hover / focus / touch listeners + the replay live in the on-demand `@rivetjs/bridge/intent` module (loaded by the driver for `intent` islands only; a resumed intent island fetches it next to the driver). The replay is a new cancelable event of the same type on the original target with the pointer / mouse fields copied (client / screen coordinates, `ctrlKey` / `shiftKey` / `altKey` / `metaKey`, `button` / `buttons`, `detail`, pointer id / type): it replays the handlers, never the default action — `preventDefault()` before dispatch plus a window capture guard (a handler calling `stopPropagation()` cannot skip it). A replayed checkbox / radio click is pre-flipped so its handlers read the state the user's click produced (the browser toggles a checkable input before dispatch and undoes it on cancel), then restored. Handlers see `defaultPrevented === true` on the replay: a framework link handler that skips prevented clicks (e.g. a client router's `<Link>`) does not navigate on the replay (the cold click already ran the browser's own navigation).
- **Late callbacks (T4 review).** After the island unmounts, every callback wrapper is a no-op (dev: one warning naming the prop): a framework timer / promise holding a stale prop never runs Rivet code on a disposed owner.
- **Hydration failure (T4).** `adapter.hydrate` throwing (mismatch) → `adapter.mount` over a cleared root with the same resumed slot nodes (dev warning). Chunk load failure → the island stays as server-rendered, one `console.error` (dev: with the island id).
- **Client-created islands (T4).** `dom.tsx` creates `rivet-island[data-ri="c<n>"]`, renders the `fallback` (disposed at mount) and the slot content (owned outputs, `Node[]` incl. their anchors) and runs the policy with `triggers.ts` (`load` / `only` / no policy: now; `idle` + `timeout`; `interaction`; `visible` + `rootMargin`: the fallback's boxes, else the root as an empty block until mounted; `media:`). Without a loader: fallback only (dev warning).
- **Callbacks (T4) measured.** First trusted mouse click → paint through a framework callback writing a Rivet signal, 12 fresh pages per variant, Chromium headless, host load 11–12: `batch` (shipped) Rivet DOM written 1.2 ms after the click, painted p50 44 ms; `_dispatch` (first-click deferral) DOM written p50 43 ms, painted p50 54 ms. `batch` stays (§3.7).
- **Visible-island preload ids (T5 ruling).** `visible` islands register `[chunk, "P", []]`: background budget, no element ids (0 B page state). Measured on the T5 build (`libs/bridge/tests` fixture app, fake adapter importing `react-dom/client` for a React-sized runtime): island chunks 313 / 679 B min, shared adapter-runtime chunk 219,797 B min; the closure (≈ 220 KB) fits the 1 MiB background budget (`BACKGROUND_DEFAULT`), so the planner prefetches the island at idle (`data-preload` entry `["/assets/Hooks.fake-….js","P",[]]`) and the viewport trigger finds it cached. Ids matter only past the budget (≥ 5 React-sized frameworks on one page), and even then the island's own `visible` trigger still loads it on entry; a boxed `data-r` element per root would cost bytes on every page for that edge. An island chunk above `VISIBLE_MAX` (8,192 B own size) is demoted to `intent` by the planner as before. Revisit with the T7 island bench.
- **Vite integration (T5).** `rivet({ bridges: [react(), …] })` on the compiler plugin (no separate plugin entry): `rivet()` returns `[bridgeHost, rivetPlugin]`; `bridgeHost` lazily imports `@rivetjs/bridge/vite` from the app root in its `config` hook (the compiler keeps no hard dependency) and adds the entries' framework plugins. Ownership = `BridgeEntry.owns(file, source)` (suffix rules, optional pragma, explicit `include` / `exclude` globs, `ownership()` helper); two owners → build error RV2145 naming both; an explicit `include` selecting a file Rivet would compile → RV2145 too. Facades are virtual modules (`\0rivet-island:<target>.tsx`, target = resolved file or `npm:<specifier>`), never files: the facade text is identical in both environments (content-hash symbol ids agree), the environment-specific parts come through virtual imports (`virtual:rivet-bridge/core` → `/server` or `/dom`, `virtual:rivet-island-def:` → server def `{ id, c, a, chunk }` / client `{ id }`, `virtual:rivet-island-client:` → component + adapter + `__rivetIsland` key (server: `null`), `virtual:rivet-island-pure:` → target with `moduleSideEffects: false`). No `?env=` query in facade ids (deviation from the plan sketch). Island key = `<root-relative file or npm specifier>#<export>`; the resume manifest gains `islands: { key → chunk URL }` and `_rPreload` maps `manifest.islands?.[key] ?? key`. Export lists come from parsing the source (`parseAst`), not `this.load` (rolldown returns no code in `buildStart`); SFCs export `default` only. An island = a capitalised (non-ALL_CAPS; `default` always) export whose value is a function / a class that `extends` something (declaration or expression; a plain class is a store / model) or a known wrapper call (`memo`, `forwardRef`, `lazy`, `observer`, `defineComponent`, `defineAsyncComponent`, `defineCustomElement` + `BridgeEntry.wrappers`), followed through local and app-module bindings (npm package bindings: by name); schemas, stores, enums, plain objects stay re-exports (T5 review F2). Overrides: `BridgeEntry.islands.include` (export names or island-key patterns, `*` wildcard) and `islands.exclude` (same forms; wins over `include` and detection). `export default X` / `export { X as Y }` of an exported component is one island under both names (an alias; excluding either name makes the alias a plain re-export). Resume builds emit every island's chunk; the build log lists island chunks no Rivet module imports (`[rivet:bridge] unused islands …`). A bridge-owned module with a value import of `@rivetjs/runtime` (parsed; `import type` / comments / strings do not count) or the runtime's leading JSX pragma is build error RV2148, not a silent skip (F1; renumbered from RV2147, which §7 reserves for the `only` hint). Non-component exports reaching the client bundle through an island → warning RV2146 (`renderedExports`). Dev: framework module edit → that island's `import.meta.hot.accept` swaps the component in place (`hot.ts` track / swap; export-list change re-sends the def + facade modules); Rivet module edit → the old driver parks its root + handle for one task and the re-created `_island` claims it by island id (islands stay mounted, state kept). Build log: `[rivet:bridge] <page>: <framework> N KB br`. Cost: `resolveId` resolves each relative import of a Rivet module once more to check ownership; the result is cached per importer + specifier (dev: cleared on file create / delete).
- **Nonce (T6).** `IslandContext.nonce` = runtime `_renderNonce()`: the resumable render's `nonce` option, sanitised like the runtime's own script nonces; `undefined` outside a resumable render or without one.
- **React adapter (T6).** Tree = `Fragment[Mark (key h), Component (key c)]` on both sides (`tree.ts`), so `useId` paths agree; ids prefixed with the island id (`identifierPrefix` = id + `-`), unique across islands. Server: `renderToString` first, a re-render through `renderToReadableStream` to `allReady` only when the string output holds a suspended boundary (`<!--$!`) or `renderToString` throws React's "suspended while responding to synchronous input" (a root suspension with no boundary above it: root `use()`, `lazy`, async components; T6 review M1): the probe costs nothing for non-suspending trees (default `auto`, no `server.stream` option yet). React 19 hoistables (title / meta / link / style) render before the first body node: the server `Mark` writes a `<rivet-head-end>` sentinel, the prefix before it is parsed into kit head fields (`IslandRender.head`), the sentinel is cut (no regex strip of the body). `onError` → reject after `allReady` (island error path). Client: `hydrateRoot` inside `startTransition` with `onRecoverableError` → RV2149 (`islandRecovered` in `@rivetjs/bridge/adapter`; a live-prop update before hydration finished may switch the root to client rendering — RV2149 too, Rivet slot nodes kept); `mount` = `createRoot().render`; `update` = `root.render`, synchronous inside a user event (`window.event`), else a transition. Slot = memo `rivet-slot` (`display: contents`, empty `dangerouslySetInnerHTML`, `suppressHydrationWarning`) whose layout effect appends Rivet's slot nodes when they are not already inside: the same nodes before and after hydration, Rivet handlers kept. `stopPropagation` in a React handler stops the native event at the island root (React's root listener): handlers above the island never see it.
- **React JSX source (T6).** Vite's oxc JSX options are global and a tsconfig `jsxImportSource` (`@rivetjs/runtime` in a Rivet app) beats them, so `@vitejs/plugin-react`'s `automatic` runtime alone compiles `*.react.tsx` against Rivet's jsx-runtime. `react()` adds `rivet:react:jsx-source` (pre): a leading `/** @jsxImportSource react */` line on owned `.tsx` / `.jsx` modules that name no import source (oxc reads leading pragmas only; line-exact map). Per file, so several JSX bridges coexist. `@vitejs/plugin-react` loads synchronously (`createRequire` of its ESM build from the app root) so `BridgeEntry.plugins()` stays sync. Build test: two islands → one react / react-dom / jsx-runtime copy in one shared chunk.
- **React types (T6).** `@rivetjs/bridge-react/types` registers exotic (`memo` / `forwardRef` / `lazy`) and class components as tags and maps functions returning `ReactElement | null | Promise<ReactNode>` to `IslandProps<P, ReactNode>`; a function returning only `null` stays a Rivet component. `IslandProps` maps a prop to `RivetContent` when its type covers the framework node type (compared without `null` / `undefined`).
- **Preact adapter (T8).** Ids: Preact's `useId` walks up to the nearest vnode with a mask (private mangled field `__m`, Preact's `_mask`, the field `@astrojs/preact` sets too; no public option hook exposes it); `tree.ts` sets `[islandId, 0]` on the island's root vnode on both sides → ids `P<id>-<n>`, unique across islands (verified on Preact 10.29.8 and 11.0.1). Preact increments the mask's counter per `useId` call, so a client island keeps one mask array for its lifetime (T8 review F1: a fresh mask per update repeated ids in components mounted later). The server's first Preact render probes the field: if the installed Preact no longer reads it, every Preact island render throws RV2150 instead of emitting the same ids everywhere. Server: sync `renderToString`; a suspension (thrown thenable or the "Use renderToStringAsync" error) re-renders through `renderToStringAsync` (keeps the `<!--$s-->` markers hydration expects; no abort signal); `lazy` needs a `Suspense` boundary. Client: `hydrate` / `render` (a throw during `hydrate` resets the root with `render(null)` before the driver's mount-over); `update` = `render(h(C, props), root)`; `unmount` = `render(null, root)`. A text mismatch is patched in place (no recoverable-error hook → no RV2149); props are never patched by hydration, so an unchanged prop keeps the server's value. No island head: Preact has no hoistables, a `<title>` renders inline. Ownership `*.preact.{tsx,jsx}` + pragma `preact`; `preact()` reuses `@rivetjs/bridge/vite` `jsxSource` (shared with `react()`), `@preact/preset-vite` optional with `reactAliasesEnabled: false` so React islands keep React. `@preact/signals` in props: out of scope v1. Build test: Preact + React islands in one app → one Preact copy, one React copy, chunks not shared.
