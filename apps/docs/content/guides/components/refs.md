---
title: Refs
description: Get the real DOM element with ref(), use it in handlers and client effects, pass it to child components, and avoid the patterns the compiler rejects.
template: guide
related: [guides/components/events, guides/state/effects, guides/components/browser-only]
---

Sometimes you need the real DOM element: to focus a field, draw on a canvas, measure a box, or hand the element to a library. A ref gives you the element. After reading this page you can use refs in handlers and effects, and you know their rules.

::example{id=focus-input}

## Get an element

Create a ref with `ref()` and pass it to the element's `ref` attribute. Call the ref to get the element:

```tsx
import { ref } from "@rivetjs/runtime/dom";

export default function Search() {
  const input = ref<HTMLInputElement>();
  return (
    <div>
      <input ref={input} placeholder="Search" />
      <button type="button" onClick={() => input()!.focus()}>
        Focus the field
      </button>
    </div>
  );
}
```

`input()` returns the element, or `undefined` while no element is attached. The type argument says which element the ref is for: passing a `ref<HTMLCanvasElement>()` to an `<input>` is a type error. `ref()` without a type argument is a `Ref<HTMLElement>` and fits any HTML element.

Import `ref` from `@rivetjs/runtime/dom`, like `clientEffect`. The compiler switches the import to the server runtime for server builds.

## When the element exists

- On the server, there is no element. `input()` returns `undefined` there.
- In the browser, the ref holds the element by the time a handler or a client effect runs.

So use the element only in browser code: event handlers and `clientEffect`. Do not use it at the top of the component, which runs on the server.

## Use a ref in an effect

A [client effect](../state/effects.md) that uses a ref starts when the element comes near the screen. This is a good default for canvases and widgets below the fold:

```tsx
import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";

export function Meter() {
  const level = signal(3);
  const canvas = ref<HTMLCanvasElement>();
  clientEffect(() => {
    const el = canvas()!;
    const ctx = el.getContext("2d")!;
    ctx.clearRect(0, 0, el.width, el.height);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(0, 0, 24 * level(), el.height);
  });
  return (
    <div>
      <canvas width={240} height={12} ref={canvas} />
      <button type="button" onClick={() => level.update((n) => Math.min(10, n + 1))}>
        More
      </button>
    </div>
  );
}
```

Pass `{ when: "idle" }` or another value to start it at a different time. See [choose when it starts](../state/effects.md#choose-when-it-starts).

A ref works like a signal: an effect that reads it runs again when an element is attached or removed. An effect that reads a ref to an element inside a `Show` sees `undefined` first, then the element once the branch appears, and `undefined` again when it goes away. Pass `Show` children as a function (`{() => <div ref={r} />}`) for that: plain JSX children of `Show` are kept while hidden (except in resumable modules, where they are passed as a function for you).

## Pass a ref to a child component

A ref is a value. Pass it as a prop, and the child puts it on its element:

```tsx
import { ref, type Ref } from "@rivetjs/runtime/dom";

function Field(props: { label: string; inputRef?: Ref<HTMLInputElement> }) {
  return (
    <label>
      {props.label}
      <input ref={props.inputRef} />
    </label>
  );
}

export function Signup() {
  const email = ref<HTMLInputElement>();
  return (
    <form>
      <Field label="Email" inputRef={email} />
      <button type="button" onClick={() => email()!.focus()}>
        Edit email
      </button>
    </form>
  );
}
```

When the prop is missing (`undefined`), nothing happens.

## Refs in lists

A handler on the element itself needs no ref: `event.currentTarget` is that element, already typed (`HTMLLIElement` here). Use `currentTarget`, not `target`: `target` is the innermost element clicked, which can be a child.

```tsx
function Row(props: { name: string }) {
  return <li onClick={(event) => event.currentTarget.scrollIntoView()}>{props.name}</li>;
}
```

Use a ref when other code needs the element. Create it inside the row's component, so each row has its own:

```tsx
function Row(props: { name: string }) {
  const item = ref<HTMLLIElement>();
  return (
    <li ref={item}>
      {props.name}
      <button type="button" onClick={() => item()!.scrollIntoView()}>
        Show
      </button>
    </li>
  );
}
```

## Callback refs

`ref` also takes a callback. It receives the element once it exists in the browser:

```tsx
let input!: HTMLInputElement;
<input ref={(el) => (input = el)} />;
```

The `!` after `input` tells TypeScript that the variable is set before you use it.

`clientEvent` accepts a variable bound this way as its target. Use it for events that have no JSX attribute, or when you need options like `passive`:

```tsx
import { clientEvent } from "@rivetjs/runtime/dom";

let box!: HTMLDivElement;
clientEvent(box, "pointermove", (event: PointerEvent) => x.set(event.offsetX), { passive: true });
// ...
<div ref={(el) => (box = el)} class="h-32 bg-slate-100" />;
```

## Rules

The compiler checks how you use refs on resumed pages:

- `ref={…}` with a `ref()` object, or any expression that yields one (a prop, an array item), is always fine.
- A callback must only assign a local variable: `ref={(el) => (local = el)}`. Other callbacks, including a variable that holds a function, fail with `Resumable ref callbacks must assign a local: ref={(el) => (local = el)}`. The editor quick fix turns it into a `ref()`.
- That variable must be assigned only by ref callbacks. Assigning it elsewhere fails with `Ref-bound locals must be assigned only by ref callbacks`.
- A callback that reaches `ref={…}` as a value (a prop holding a function) would never run on a resumed page, so the page fails to render: `Cannot resume a ref callback passed as a value; use ref()`.
- A `ref` key inside a spread (`{...props}`) works like a `ref` attribute: a `ref()` object gets the element, also on a resumed page. A ref callback in a spread runs on pages the browser renders, but not on a resumed page; use `ref()` there. When an explicit `ref={…}` follows the spread, only the explicit one is used.

Do the work with the element in a handler or a client effect, not in a ref callback.

## Common mistakes

- **Using the ref at the top of the component.** The element does not exist on the server. Move the code into a handler or `clientEffect`.
- **Doing work in the callback.** `ref={(el) => el.focus()}` is rejected. Use a `ref()`, then focus it in a `clientEffect`.
- **Reaching for a ref to read an input's text.** For text fields and checkboxes, [model:value](./forms-and-input.md) is shorter.

## See also

- [Effects](../state/effects.md)
- [Browser-only code](./browser-only.md)
- [Events](./events.md)
