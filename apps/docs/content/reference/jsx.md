---
title: JSX
description: Every JSX feature the Rivet compiler supports, from attributes and events to model bindings, refs and the preload directive, and what it rejects.
template: reference
related: [guides/components/components, guides/components/events, guides/components/forms-and-input, guides/components/refs, gotchas/spread-props-and-style]
---

Rivet JSX looks like React JSX, but the compiler turns it into fixed HTML at build time. It does not create a virtual DOM. Some React habits are compile errors; the exact messages are listed at the end.

TypeScript setup: `"jsx": "preserve"` and `"jsxImportSource": "@rivetjs/runtime"`.

## Elements

| Form | Example | Notes |
| --- | --- | --- |
| HTML element | `<div>`, `<my-widget>` | Lowercase names. Custom element names with `-` work; their types accept any attribute except `on…` names that are not supported events and the unsafe ones below. |
| SVG | `<svg><path d="…" /></svg>` | `svg` and its child tags render in the SVG namespace. `xlink:href` works. |
| MathML | `<math><mi>x</mi></math>` | `math` and its child tags render in the MathML namespace. |
| Component | `<Card title="Hi" />` | Capitalized name or `obj.Member`. Calls your function with the props. |
| Fragment | `<>…</>` | Groups children without an element. |
| Void element | `<br />`, `<img />`, `<input />` | Must not have children. |

`<script>` and `<style>` are not allowed in JSX. Use files that the build bundles.

## Children

| Child | Renders |
| --- | --- |
| Text | Text. Whitespace follows React rules: lines are trimmed and joined with one space. |
| HTML entities | `&copy;`, `&nbsp;`, `&#169;`, `&#xA9;` are decoded at build time. All HTML named entities are known. |
| `{"string"}`, `{42}`, `{10n}` | Escaped text. |
| `{true}`, `{false}`, `{null}`, `{undefined}` | Nothing. |
| `{[a, b]}` | Each item in order. |
| `{<b>x</b>}`, `{cond ? <A /> : <B />}` | The element. |
| `{count()}` (reads a signal) | Text that updates when the signal changes. |
| `{() => …}` | A function child is called and re-runs when a signal its body reads changes (also on resumed pages, also with a block body). Components receive it as `children` and decide when to call it. |

`<textarea>` and `<title>` take only text children (no elements). Text directly inside `<table>`, `<tr>` and similar is rejected. Nesting the HTML parser would repair, such as `<div>` inside `<p>`, is rejected.

## Attributes

| Form | Example | Result |
| --- | --- | --- |
| String | `id="main"` | `id="main"` |
| Expression | `href={url}` | Escaped value. `null` and `undefined` leave the attribute out. |
| Reads a signal | `class={open() ? "on" : "off"}` | Updates when the signal changes. |
| No value | `required` | `required` |
| Boolean attribute | `disabled={busy}` | Present when truthy, left out when falsy. Applies to `checked`, `disabled`, `hidden`, `inert`, `open`, `readonly`, `required`, `selected`, `multiple`, `autofocus` and other HTML boolean attributes. |
| `popover` | `popover={open}`, `popover="manual"` | `true` (or bare `popover`) renders the empty keyword (`auto`, light dismiss), `false` leaves it out, a string is the keyword. `hidden="until-found"` keeps its keyword. |
| Uncontrolled defaults | `defaultValue={v}`, `defaultChecked={on}` | The initial value / checkedness: `value` / `checked` attributes on the server, the `defaultValue` / `defaultChecked` properties in the browser (a user edit is kept). On `<textarea>`, `value` and `defaultValue` are its content. |
| Other `false` | `aria-expanded={false}` | `aria-expanded="false"` |
| `class` | `class="card"` | Use `class`. `className` also works and renders as `class`. |
| Class object / array | `class={{ active: on(), big: true }}`, `class={["a", on() && "b"]}` | Written in the attribute: falsy and `true` skipped, arrays flattened, object keys kept when truthy. A non-literal object (variable, prop) is not normalized: use `cx(value)`. |
| `class:name` | `class:active={on()}` | Toggles one class: truthy adds it once, falsy removes it. Combines with `class` and spreads. |
| `style` object | `style={{ color: c(), marginTop: "1px", "--x": n() }}` | One `style` attribute on the server; CSSOM `setProperty` in the browser (works under a strict `style-src` CSP). camelCase → kebab-case. null / undefined / booleans / `""` skip a property; numbers get `px` like React, except `0`, `--custom` and unitless properties (`opacity`, `zIndex`, `lineHeight`, …). |
| `style:prop` | `style:color={c()}`, `style:background-color={bg}` | One property. Custom properties need the object form (`style:--x` is not valid TSX). |
| `for` | `for="email"` | `htmlFor` also works and renders as `for`. |
| `data-*`, `aria-*` | `data-id={id}` | As written. |

Style values reject `url(`, `src(`, `image-set(`, `expression(`, `javascript:` and `\ ; { } /*`: a literal fails at build time (`Unsafe style value for background: …`); a dynamic value drops the property (development build: one warning). Property names must be CSS identifiers or `--custom`: `Invalid style property: …`. Style strings (`style="color:red"`, `style={text}`) fail: `style strings are not supported: use a style object …`. Details: [CSS and Tailwind](../guides/styling/css-and-tailwind.md#change-other-styles-style-objects-css-variables-and-data-attributes).

URL attributes (`href`, `src`, `action`, `formaction`, `poster`, `xlink:href`) reject `javascript:`, `vbscript:` and `data:` values: `Unsafe URL attribute` (at build time for literals, at render time for expressions).

Not supported:

- `innerHTML`, `dangerouslySetInnerHTML`, `srcdoc`: `Unsafe or unsupported native attribute: innerHTML`. A `style` key inside a spread object fails the same way: write `style` as an attribute.
- Children spread `{...items}`: `Spread children are not supported`. Attribute spreads work: `<div {...props}>` merges keys with the other attributes in source order (later wins, same checks as attributes), `<Card {...props} />` builds one props object. A spread `children` key is the content (element) or the `children` prop (component) unless JSX children are present: those win. A spread `ref` key works like a `ref` attribute (an explicit `ref` after the spread wins); see [refs](../guides/components/refs.md#rules).
- Namespaced tags such as `<svg:rect>`: `Unsupported namespaced tag`.

## Events

`on` + event name in PascalCase, with a function value:

```tsx
<button onClick={() => count.set(count() + 1)}>Add</button>
<input onInput={(event) => query.set((event.target as HTMLInputElement).value)} />
```

Supported names: every event of TypeScript's `HTMLElementEventMap` (lib.dom) as `on` + PascalCase words: `onClick`, `onDblClick`, `onInput`, `onKeyDown`, `onPointerOver`, `onPaste`, `onCopy`, `onCut`, `onTransitionEnd`, `onAnimationStart`, `onToggle`, `onBeforeToggle`, `onClose`, `onCancel`, `onInvalid`, `onFormData`, media events (`onPlay`, `onTimeUpdate`, `onLoadedMetadata`, …), and the rest.

- One generated list feeds the compiler and the JSX types: `scripts/gen-events.mjs` → `libs/compiler/rust/src/events_data.rs` + `libs/runtime/jsx-events.ts` (rerun after a TypeScript upgrade; a test fails when stale). Handler event types come from lib.dom (`onInput`: `InputEvent`, `onError`: `Event`).
- Legacy `webkit…` names are not included.

- Other names, including lowercase `onclick` and wrong casing such as `onTransitionend`, fail with `Unknown native event: onclick`.
- `onClickCapture` (any `…Capture`) listens in the capture phase; on resumed pages it records a capture entry (dispatched outermost-first).
- `window:onResize={fn}` and `document:onKeyDown={fn}` on any element listen on `window` or `document`.
- `on:name={fn}`: custom events (custom elements, `dispatchEvent(new CustomEvent("name"))`); `name` is the exact event type, any case (`on:value-change`, `on:openChanged`); letters, digits, `-`, `_`. Never capture. Handler type: `CustomEvent`.
  - Server: not rendered. DOM: `addEventListener(name)` on the element.
  - Resume: delegated like native events (document capture listener) — works for bubbling and non-bubbling events dispatched on the element or its light-DOM children; an event that stays inside a shadow root (`composed: false`) does not reach it.

## Properties: prop:

- `prop:name={value}` sets the element property `el.name = value` (custom element data, `scrollTop`, `indeterminate`…); updates when the value's signals change.
- Server: not rendered, not evaluated in resumed modules (no attribute). DOM: set when the element is created.
- Resume: compiled to a browser effect on the element (like `clientEffect`, runs at load/idle): the value expression runs in the browser and stays bound to the signals it reads. What it uses from the component must be :term[serializable]{id=serializable}, as for handlers. Inside components only.
- Names: identifiers only. `prop:innerHTML`, `outerHTML`, `srcdoc`, `style`, `on…`, `__proto__` fail with `Unsafe or unsupported native attribute: prop:innerHTML`.
- URL properties (`href`, `src`, `formAction`…) get the URL attribute rules: a literal unsafe value fails at build time (`Unsafe URL attribute`, RV1101); a dynamic one becomes `about:invalid#rivet`.
- Pay per use: the helpers live in `@rivetjs/runtime/dom` and load with the page's symbol chunk; the resume runtime entry has no `prop:` or select-model code.
- Not inside spreads: write `prop:` and `on:` as explicit attributes.
- Handlers never run on the server. Values they use from the component must be :term[serializable]{id=serializable}. See [Function is not serializable](../gotchas/function-is-not-serializable.md).
- A handler must not create JSX: `JSX inside handlers, effects and computeds is not resumable`. Put the JSX in the component and switch it with a signal.
- A handler cannot use `this`: ``Resumable code cannot capture `this` ``. Use `event.currentTarget` (the handler's element, also in resumed handlers) or `event.target`.

## model: bindings

Two-way binding between a form field and a signal:

```tsx
const name = signal("");
const agree = signal(false);

<input model:value={name} />
<textarea model:value={name} />
<input type="checkbox" model:checked={agree} />
```

| Binding | Allowed on |
| --- | --- |
| `model:value` | `<textarea>`, `<input>` with no `type` or `type` `text`, `search`, `email`, `url`, `tel`, `password`; `<select>` (`Signal<string>`, or `Signal<string[]>` with `multiple`) |
| `model:checked` | `<input type="checkbox">` |

The value must be a signal written as a name or property (`name`, `form.name`). A dynamic `type` and other input types fail with `Unsupported model binding: model:value`.

`<select value={v}>` / `model:value` on `<select>`:

- Server: no `value` attribute (browsers ignore it); the matching `<option>` gets `selected`. Matching: `String(v) === option value`; an array selects each listed value. Option value = its `value` attribute, else its static text (whitespace collapsed).
- Options count when written inside the select's JSX, also through expressions (`{items.map((i) => <option value={i}>…</option>)}`). Options rendered by another component or with dynamic text and no `value` are not compared: give them a `value` or write `selected` yourself (an explicit `selected` always wins).
- DOM: the value is applied after the children exist, and again when options are added, removed or change `value` (a `MutationObserver`, only on such selects).
- Resume: SSR markup is already selected; `model:value` compiles to a browser effect on the select (runs at load/idle, code in the symbol chunk). A selection the user changed before it runs wins over the signal; then both directions stay bound (`multiple` → array of values).
- Not with a spread on the `<select>` (`{...props}`): the value stays a plain attribute. A `<textarea>` with `model:value` cannot also have children.

## ref

```tsx
import { ref } from "@rivetjs/runtime/dom";
const canvas = ref<HTMLCanvasElement>();
<canvas ref={canvas} />          // canvas() → the element, or undefined
<Child inputRef={canvas} />      // forwarded: the child writes <input ref={props.inputRef} />
let el!: HTMLCanvasElement;
<canvas ref={(e) => (el = e)} /> // callback form
```

- Type per element: `ref?: Ref<E> | ((el: E) => void)`, where `E` is the tag's element type. A `Ref` for another element type is a type error; `Ref<HTMLElement>` (the default of `ref()`) fits every HTML element.
- `ref()` is signal-backed: an effect that reads it re-runs when an element is attached, and when its owner unmounts (the ref goes back to `undefined` unless a newer element took it). On the server it is a no-op that reads `undefined`.
- The callback runs in the browser once the element exists, never on the server.
- Resumable modules: any expression is accepted except a local callback. A callback must assign a local variable (`Resumable ref callbacks must assign a local: ref={(el) => (local = el)}`, also for a variable holding a function). A function reaching `ref={…}` as a value (a prop) fails the render: `Cannot resume a ref callback passed as a value; use ref()`.
- A `ref` key in a spread is applied like the attribute; on a resumed page only `ref()` objects, not callbacks. See [refs](../guides/components/refs.md).

## preload directive

```tsx
<button preload="eager" onClick={save}>Save</button>
```

Sets when the element's handler code loads: `"eager"`, `"idle"`, `"visible"`, `"intent"` or `"interaction"`. It is not rendered as an attribute. Other values fail with `preload must be one of "eager", "idle", "visible", "intent", "interaction"`. On `<audio>` and `<video>`, `preload` is the normal HTML attribute. See [preloading](../guides/performance/preloading.md).

## Slots

Component side: `<slot />` renders `children`; `<slot r:name="header">fallback</slot>` renders the `header` prop (fallback when it is `null` or `undefined`); `r:args={[item, index]}` passes arguments to a scoped slot.

Usage side: `r:slot="header"` on a direct child of a component element passes it as the `header` slot. It renders only when the component renders the slot. A conditional child, `{open && <h2 r:slot="header">…</h2>}` or `{open ? <h2 r:slot="header">…</h2> : null}`, passes the slot only when the condition is true.

```tsx
<Card>
  <h2 r:slot="header">Title</h2>
  Body
</Card>
```

A destructured slot prop that is missing is a compile error that names the fix, for example ``<slot r:name="children">: add `children` to the destructured props of Card``. Types: `Slot`, `Slots`, `Content` from `@rivetjs/runtime/jsx-runtime`. See [slots](../guides/components/slots.md).

## Structural helpers

Import these by name from `@rivetjs/runtime/dom` (the server build rewrites the import). Namespace imports such as `rt.For` are rejected.

| Helper | Use |
| --- | --- |
| `For` | Keyed list: `<For each={items} by={(item) => item.id}>{(item, index) => …}</For>`. `each` is the array (`each={items()}`, live like any prop) or a function that returns it (a signal works). `item` and `index` are accessors. See [lists](../guides/components/lists.md). |
| `Show` | `<Show when={open()} fallback={…}>…</Show>`; `keyed` re-creates the branch when the value changes; a function child gets the value as an accessor. See [conditional rendering](../guides/components/conditional.md). |
| `Switch`, `Match` | First `Match` whose `when` is truthy, else the `Switch` `fallback`. |
| `Async` | Async data: `load`, `fallback`, `error`, child function. See [async](../guides/components/async.md). |
| `Suspense` | One fallback for several `Async` parts. See [Suspense and transitions](../guides/components/suspense.md). |
| `ErrorBoundary` | `fallback(error, reset)` for failures inside. See [error boundaries](../guides/components/error-boundaries.md). |
| `Dynamic` | A tag name or component chosen by a value: `<Dynamic component={tag} />`. |
| `Portal` | Renders its children into `document.body` (or `mount`), browser only. See [Dynamic and Portal](../guides/components/dynamic-and-portal.md). |
| `Provider` | Context value: `<Provider token={Theme} value="dark">…</Provider>`. |
| `lazyComponent` | Component whose code loads on demand. |
| `clientOnly` | Component that renders only in the browser, with an optional `fallback`. |

`ChunkGroup` (`<ChunkGroup preload="visible">…</ChunkGroup>`) groups a part of the page into its own code chunk with `resume.chunks: "group"`.

## Compiler messages

- Every message carries `file:line:column` (UTF-16 columns, 1-based), syntax errors from the parser included; Vite shows it in the overlay.

| Message | Cause |
| --- | --- |
| ``Browser global `window` is read during server rendering; move it into a handler, clientEffect or clientEvent`` | `window`, `document`, `localStorage`… in render code. See [Window is not defined](../gotchas/window-is-not-defined.md). |
| ``Resumable code cannot capture `x`: class instances are not serializable`` | A handler uses an object created with `new` in the component (other than `Map`, `Set`, `Date`, `URL`, `URLSearchParams`, `RegExp`, typed arrays, `ArrayBuffer`, `DataView`, `Error`, or a data class declared in a component module). |
| ``Cannot resume `x.field`: X instance holds a resource …`` (also "has a private field", "extends `Base`") | A handler uses an instance of a class from the component module that cannot resume as data: it reads `window` / `document` / `WebSocket` … while constructed, has a `#private` field, or extends a class that is not a data class of the same module. Create it inside the handler. |
| `Spread children are not supported` | `{...items}` as children. |
| `Cannot resume spread event handler onClick: …` | A function under an `onX` key in a spread, on a resumed page, that Rivet cannot rebuild in the browser (for example a `.bind(…)` result written inline in the object, or a function from a module that is not resume-compiled). Write it as an inline function in the object, a constant in the component, or pass it as `onClick={…}`. |
| `Cannot resume two click handlers on one element …` | The same element gets `onClick` from a spread and from an attribute. Keep one. |
| `Unsafe or unsupported native attribute: innerHTML` | `innerHTML`, `srcdoc`, `dangerouslySetInnerHTML`, or a `style` key in a spread. |
| `style strings are not supported: use a style object …` | `style="…"` or a style string expression. |
| `Unsafe style value for background: …` | A literal style value with `url(`, `expression(`, `javascript:`, `;`… |
| `Invalid style property: …` | A style key that is not a CSS identifier or `--custom` property. |
| `Use one class attribute (class or className) per element` | `class` and `className` both on one element (without a spread). |
| `Script/style JSX content is not supported; use build-time assets` | `<script>` or `<style>` in JSX. |
| `Void elements cannot have children` | Children inside `<br>`, `<img>`, `<input>`… |
| `Textarea/title children must be scalar text expressions; elements and fragments are not supported` | Elements inside `<textarea>` or `<title>`. |
| `Unsupported parser-repaired native nesting: div` | Nesting HTML does not allow, such as `<p><div>`. |
| `Text is not supported directly in table structure` | Text directly in `<table>`, `<tr>`… |
