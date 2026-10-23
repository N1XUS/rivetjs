# Slots

Web-component syntax, compiled to lazy props. No runtime cost: lowering happens in the compiler.

## Component side
- `<slot />`: default slot = `children`.
- `<slot r:name="header">fallback</slot>`: named slot = prop `header`; fallback renders only when the prop is `null`/`undefined`.
- `<slot r:name="row" r:args={[item, index]}>fallback</slot>`: scoped slot; calls `row(item, index)`. Pass accessors (`() => value`), like `For`.
- Slot source: the component's first parameter.
  - `function C(props)` → `props.header`.
  - `function C({ header })` → local `header`; a missing key is a compile error naming the fix.
- Native `<slot>` stays native inside `<template>` and with a plain `name` attribute (declarative shadow DOM).

## Usage side
- `r:slot="x"` on a direct child of a component element → lazy prop `x: () => <el/>`.
  - Several children with one name → one thunk returning the list.
  - Conditional child `{c && <el r:slot="x"/>}` / `{c ? <el r:slot="x"/> : null}` → `x: c ? () => <el/> : undefined` ([slot presence](#slot-presence-style-the-parent-by-whether-a-slot-was-passed)).
  - Content is not evaluated until the component renders the slot (unrendered slot = no work).
- Other children → `children`, eager (unchanged). Lazy default slot: function child `{() => <p/>}`.
- Scoped content: function prop or function child, e.g. `row={(item, i) => <li>{i()}: {item()}</li>}`.
- Errors (compile time):
  - `r:slot` not directly under a component element.
  - `r:slot` name also passed as an attribute.
  - Non-literal `r:slot`; `r:slot="children"` (use plain children).
  - `r:name` not a string literal; `r:args` not an array literal.

## Slot presence (style the parent by whether a slot was passed)
- Plain check, no helper: `<div class={props.header ? "card has-header" : "card"}>` (or destructured `header ? … : …`).
  - A slot prop is a thunk / function / value or `undefined`: truthiness = presence. Reading it never calls it → content not evaluated (a component that only checks presence never renders the content).
  - All targets: server, DOM, resume (a component given slot functions adopts with its parent; nothing is serialized).
  - Types: `Slots<"header">` props are optional → `props.header ? … : …` type-checks.
- Props are live (spec `docs/design/specs/2026-10-07-live-props-design.md`): a dynamic prop (`header={on() ? () => <h2/> : undefined}`, `variant={v()}`) arrives as an own getter, so presence that changes needs no re-created component — read the prop where it is used:
  - in a binding (`class={props.header ? "card has-header" : "card"}`, a `{…}` child): re-evaluates when the condition changes, the element is kept (client mounts, adopted boundaries).
  - in the component body (`const has = !!props.header`) or destructured (`function C({ header })`): a value read once at creation (Solid semantics; wrap deliberate body reads in `untrack`).
  - server: read once per render. Resumed page: the adopt run binds the same reads over the server nodes, so updates land in place.
- Static presence (`header={() => <h2/>}` or none): a data property, no getter (0 cost).
- Conditional `r:slot` child: `{cond && <h2 r:slot="header">…</h2>}` / `{cond ? <h2 r:slot="header"/> : null}` (either or both branches, same slot name; other branch `null` / `undefined` / `false`) → prop `header: cond ? () => <h2/> : undefined`; a slot passed both directly and conditionally → `slot "header" is passed more than once`. DOM: a `<slot>` over a props member lowers to an accessor (`_insert(el, () => props.header ?? fallback, m)`, CORE-GAPS (a) 2026-10-08), so the content / fallback follow the condition on client mounts and adopted boundaries. A destructured slot prop (`function C({ header })`) is a value read once.
- CSS alternative: `.card:has(> [data-slot="header"])`. Slot content carries no marker (`r:slot` is removed; no runtime attribute). Add your own: `<h2 r:slot="header" data-slot="header">`, or let the component render its own wrapper only when present: `{header ? <header class="card-header"><slot r:name="header" /></header> : null}` → `.card:has(> .card-header)`.
- Tests: [slot-presence](../../libs/runtime/tests/slot-presence.test.ts) (server HTML + evaluation counts, Chromium DOM).

## Types (`@rivetjs/runtime/jsx-runtime`)
- `Slot<A extends unknown[] = []>`: `(...args: A) => Children`.
- `Content`: eager children.
- `Slots<"header" | "footer">`: optional `Slot | Content` props.
- `r:slot` allowed on intrinsic elements and components; `<slot>` accepts `r:name`, `r:args`.

## Resumability
- Slot content (`r:slot` thunks, JSX-returning function props / children, eager JSX) is not serialized: a component receiving it adopts with its parent, which passes the real values ([resumability](resumability.md#mechanics)).
- Slot context comes from the render site (the child).

## Control flow (`Show` / `Switch` / `Match` / `Dynamic`)
- Exported from `@rivetjs/runtime/dom` and `@rivetjs/runtime/server` (like `For`); tree-shaken when unused.
- Why: `{n() > 5 ? <A/> : null}` re-creates `<A/>` (state lost) on every change of `n` while true; `Show` keeps it.
- `<Show when={() => value} fallback={…} keyed?>{(v) => …}</Show>`:
  - `when`: accessor; memoized by truthiness → branch created once, kept while truthy;
  - function child: lazy, gets the value accessor `v: () => NonNullable<T>` (live; `keyed`: constant) — always an accessor, also with `keyed` (one rule, not Solid's keyed → value; ruling 2026-10-08);
  - `keyed`: re-created when the value identity (`Object.is`) changes;
  - `fallback`: function / `r:slot="fallback"` thunk (lazy) or eager value.
- `<Switch fallback={…}><Match when={() => …} keyed?>{(v) => …}</Match>…</Switch>`: first truthy `Match` renders; re-created only when the matched index changes (or the value, if `keyed`). `Match` renders nothing outside a `Switch`.
- Lazy vs eager:
  - function children / function `fallback` / `r:slot` thunks: created on show, disposed on hide;
  - eager JSX children (`<Show when={…}><A/></Show>`): created once at construction (even while hidden, both targets) and kept (detached while hidden). Prefer function children. `fallback` is not thunked: pass a function.
- `<Dynamic component={X} {...props}/>`:
  - function → called with the other props (a component);
  - string → intrinsic tag: same validation as compiled attributes (`bindAttribute` / server `attribute`: unsafe names, `on*` strings, `style` throw; unsafe URLs render as `about:invalid#rivet`, media `data:` rule by tag); function values = accessors (DOM reactive, server read once); `onX` functions = listeners (server: omitted); `ref` gets the element; `children` = content;
  - tag names: `/^[A-Za-z][A-Za-z0-9]*(-[\w.-]+)*$/`, rejected (`Unsafe dynamic tag`): `script style template textarea title iframe frame frameset object embed noscript noembed noframes plaintext xmp base meta link html head body`; void tags reject children; `svg` / `math` → their namespace, else the parent's;
  - props are live (CORE-GAPS (e), 2026-10-08): the rest props are forwarded with `_restProps` (getters unread; a component gets them as live props, a tag binds them as one `_spread(el, rest, 3)` — attributes / `children` update in place, `ref` once); a `component` getter (`component={c()}`) is read through a `computed` inside a `_scoped` accessor: a new value disposes the previous content and renders the new one untracked (no state carried over); a plain `component` value renders once without the accessor. Server: eager values (unchanged).
- Server: only the active branch renders, same HTML as the ternary.
- Resume ([resumability](resumability.md)): the adopt run walks the server's active branch (`Show` / `Switch` keep their nodes and the state inside); a branch whose markup does not align renders its boundary in the browser.
- Tests: [control-flow](../../libs/runtime/tests/control-flow.test.ts) (compiled DOM in Chromium, server HTML, types).

## `Portal` and `createId`
- `<Portal mount?={element}>{…}</Portal>` (`@rivetjs/runtime/dom` / `server`): renders children into an owned `<div data-rivet-portal>` appended to `mount` (default `document.body`), removed on cleanup; nothing in place.
  - server: renders nothing (browser-only content); resumed pages: put it behind a signal (`<Show when={open}>`) so it renders in the browser once open;
  - cdk overlays (Dialog, Popover, MenuTrigger) portal through `<Overlay>` (`@rivetjs/cdk/portal`: cdk Portal + FocusScope), only while open; no native top layer.
- `createId()` (`@rivetjs/runtime/id`): document-unique id for ARIA relations.
  - decimal counters, namespaces never alphanumeric extensions of each other: server `rv` + n per render (the router opens `withIdScope("rv", …)` around every page render → same page, same ids, whatever the process rendered before); server outside any scope (module level, after an `await`, plain `renderToString`) `rvs` + n (process-wide); browser (`browser` condition) `rvc` + n → ids of regions re-created after resume never collide with server markup; render cache fragments `rv-<hash>-` + n (`@rivetjs/runtime/server-cache`);
  - `withIdScope(prefix, fn)`: own counter from 0 (deterministic HTML per render root, tests, multi-root pages; wrap a direct `renderToString` / `renderResumable` call in it for byte-stable output);
  - an id depends on its render order in the page: pass explicit `id`s where a part must be byte-identical wherever it renders (snapshot tests of a fragment).
- Tests: [portal-id](../../libs/runtime/tests/portal-id.test.ts).

## Spread (`{...x}`)
- Components: `<C a={1} {...rest} b={x()} />` → one props object, plain object spread in source order (later keys win). Snapshot like other props: getters on `rest` are read at spread time. A spread `children` is the `children` prop; JSX children (added after the spreads) win. `r:slot` / slot props are added after the attributes (a slot wins over a spread key of the same name).
- Native elements: `<div class="a" {...attrs} id={id()}>` → the element's plain attributes (static and dynamic) and spreads merge into one object in source order.
  - Ordering rule: source order, later wins — an attribute before the spread is overridden by a spread key, one after it overrides the spread; a key the spread drops falls back to the earlier attribute.
  - Not merged (own bindings, unchanged): `onX={…}`, `ref`, `model:*`, `window:`/`document:` events, `r:slot`, `preload` directive. An explicit `onClick` and a spread `onClick` are both listeners (explicit first).
  - Values: same rules as compiled attributes — unsafe names, `on*` strings, `innerHTML` / `srcdoc` / `style` / `dangerouslySetInnerHTML` throw (`Unsafe attribute name`; `onClick: "…"` in the DOM: `Event handler must be a function…`); URL attributes neutralized (`about:invalid#rivet`, media `data:` rule by tag; dev: warns once per attribute + scheme, like non-spread URLs); `null`/`undefined`/`false` booleans omitted; a function value is an accessor; `on[A-Z]` functions are listeners; `ref` keys are ignored; `children` → content (below); `className`/`htmlFor` = `class`/`for` (later wins).
  - `children` key (React semantics): the element's content when it has no JSX children (whitespace-only text and `{/* */}` count as none); same rendering as a `{children}` child, reactive with the object (DOM, resume). JSX children win: the key is dropped. Void elements, `textarea`, `title`: no spread content.
  - Static attributes on a spread element keep their compile-time checks (`Unsafe URL attribute`, unsafe names).
  - Server: `spreadAttributes(obj, tag, ns?)` → attribute records; `on[A-Z]` functions omitted. No JSX children: content slot `spreadChildren()` right after it (the `children` that call read; object evaluated once).
  - DOM: `_spread(el, () => obj[, 1])` effect (`1`: no JSX children → `children` inserted into the element): tracks the object, diffs keys per run (a removed key is removed / its listener goes inert; handler swap keeps one listener, runs batched). Plain attributes after the last spread (IMPL-SPREAD, ABI 5) are not in the object: static ones in the template, the rest one `_attrs(el, values, "names")` binding; the spread gets their names as `exclude` (`_spread(el, v, flags, null, "names")`), so they still win over its keys, also while unset.
- Resume: a spread element adopts with its boundary like any other element (`_spread` over the server node); spread event handlers are ordinary functions of the adopt run. No serialization rules.
- Wrapper component:
  ```tsx
  function Button(props: { class?: string; children?: Content } & Record<string, unknown>) {
    return <button {...props} class={"btn " + (props.class ?? "")} />; // props.children is the content
  }
  ```
- Spread children (`{...items}`) stay unsupported (`Spread children are not supported`, RV1002).
- Zero cost: helpers are separate exports (server: own module `server-spread.ts`), emitted/imported only where a spread appears; spread content only on spread elements without JSX children.
- Tests: [spread](../../libs/runtime/tests/spread.test.ts) (server HTML, Chromium DOM, resume, types, tree-shaking), [compiler](../../libs/compiler/tests/spread.test.ts).

## Example
```tsx
function Card({ header, footer }: Slots<"header" | "footer"> & { children?: Content }) {
  return (
    <article>
      <slot r:name="header"><h2>Untitled</h2></slot>
      <slot />
      <slot r:name="footer" />
    </article>
  );
}
<Card>
  <h2 r:slot="header">Title</h2>
  Body
  <small r:slot="footer">Footer</small>
</Card>;
```
- Live demo: playground `/slots` (`apps/playground/src/routes/slots.tsx`).
