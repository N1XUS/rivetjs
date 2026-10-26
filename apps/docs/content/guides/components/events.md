---
title: Events
description: Handle clicks, input and form submits with onX attributes, listen on window and document, and learn how handler code reaches the browser.
template: guide
related: [guides/components/components, guides/state/batching, guides/performance/preloading]
---

Event handlers are where most browser work happens in Rivet. After reading this page you can handle element events, listen on `window` and `document`, and you know how Rivet loads handler code only when it is needed.

::example{id=counter}

## Handle an event

Add an `onX` attribute with a function. The name is `on` plus the event name with a capital letter: `onClick`, `onInput`, `onSubmit`, `onKeyDown`.

```tsx
import { signal } from "@rivetjs/reactivity";

export default function Like() {
  const likes = signal(0);
  return (
    <button type="button" onClick={() => likes.update((n) => n + 1)}>
      Like ({likes()})
    </button>
  );
}
```

The handler gets the native DOM event.

### Read the element

Use `event.target` to reach the element, and tell TypeScript its type:

```tsx
<input
  onInput={(event) => {
    query.set((event.target as HTMLInputElement).value);
  }}
/>
```

:::note
On a resumed page Rivet listens for events once at the document level. While your handler runs, `event.currentTarget` still reads as your element, as the JSX types say. After the handler returns it is `null`, as with any native listener.
:::

For two-way binding of text fields and checkboxes there is a shorter way: [model:value and model:checked](./forms-and-input.md).

## Supported events

Every event of the browser's `HTMLElementEventMap` works as `on` + its name in PascalCase: `onClick`, `onInput`, `onKeyDown`, `onPointerDown`, `onPaste`, `onTransitionEnd`, `onAnimationEnd`, `onToggle`, `onPlay`, `onTimeUpdate` and so on. The JSX types give each handler its event type. A misspelled name stops the compiler with `Unknown native event: onSomething`. The full rules are in the [JSX reference](/reference/jsx.md).

## Custom events and custom elements

- `on:name={fn}` listens for the event type `name` exactly, any case: `<my-picker on:value-change={(event) => value.set(event.detail)} />`.
- `prop:name={value}` sets an element property instead of an attribute: `<my-chart prop:data={points()} />`. Server HTML leaves it out; the browser sets it (on resumed pages through a small browser effect at load).
- Works on resumed pages: custom events are delegated like native ones, also when they do not bubble. Events kept inside a shadow root (`composed: false`) do not reach the page listener.

## Stop the default action

Call `event.preventDefault()` as usual. It works even on the first click, before any handler code was loaded: Rivet loads the code, runs the handler, and only then lets the browser continue.

```tsx
<form
  action="/search"
  onSubmit={(event) => {
    event.preventDefault();
    results.set(search(query()));
  }}
>
  <input name="q" model:value={query} />
  <button>Search</button>
</form>
```

If the browser has no JavaScript, the form still submits to `/search`. This is a good default: see [links and forms without JS](/best-practices/links-and-forms-without-js.md).

## Listen on window or document

Use the `window:` or `document:` prefix on any element. The listener is attached for as long as that element is on the page:

```tsx
<p window:onKeyDown={(event: KeyboardEvent) => keys.update((k) => k + event.key)}>
  You typed: {keys()}
</p>
```

For more control (passive listeners, `once`, media queries) use `clientEvent`. See [browser-only code](./browser-only.md#listen-to-browser-events).

## How handler code reaches the browser

On a server-rendered page, the browser does not download your handlers when the page loads. Rivet marks the element in the HTML and starts a tiny loader script.

1. The page has loaded and the browser is idle. Rivet downloads the handler code at low priority, without running it.
2. You rest the pointer on the button or focus it. Rivet downloads what has not arrived yet, at high priority.
3. You press the button. Rivet makes sure the code is loaded.
4. The handler runs. Signals change, and the page updates.

The handler runs inside a [batch](../state/batching.md), so several writes cause one update (for the first mouse click on a page, that update lands one task later: see [the first mouse click on a page](../state/batching.md#the-first-mouse-click-on-a-page)). You can tune when code downloads with the `preload` attribute, for example `<button preload="idle">`. See [preloading](/guides/performance/preloading.md).

## What a handler can use

A handler can use anything in the component: signals, props, local constants, local functions, class instances. The browser runs the component's code again when it wakes up, so it has the real values.

```tsx
export function Cart({ items }: { items: { id: string; cents: number }[] }) {
  const total = signal(0);
  const add = (cents: number) => total.update((t) => t + cents); // a local function: fine
  return (
    <ul>
      {items.map((item) => (
        <li>
          <button onClick={() => add(item.cents)}>Add</button>
        </li>
      ))}
    </ul>
  );
}
```


## Handlers bind once

Rivet reads the value of an `onX` attribute once, when the element renders, and keeps that handler. Changing a signal later does not swap it. Solid works the same way, and it costs nothing at runtime.

So the handler cannot be picked with state outside a function. Here `editing()` would be read only once, during render, and the button would keep whichever handler it got first. The compiler rejects it:

```tsx
<button onClick={editing() ? save : edit}>…</button>
```

Put the choice inside an arrow, so it runs on every click:

```tsx
<button onClick={() => (editing() ? save() : edit())}>…</button>
```

The compiler stops with RV1016 on this pattern: a call such as `onClick={getHandler()}`, or a `?:`, `&&`, `||` or `??` that calls something. `onClick={handle.bind(null, id)}` is allowed, since it creates the handler once on purpose. The editor quick fix **Wrap handler in arrow function** rewrites the value to `(event) => (…)?.(event)`.

Passing a handler on is fine and binds once too: `onClick={props.onClick}`, `onClick={handler}`. The same goes for a choice made without a call, such as `onClick={disabled ? undefined : props.onClick}`. Leaving the handler out (`undefined` or `null`) means the element gets no handler.

## Common mistakes

- **Using `this`.** Handlers cannot use `this`. Use `event.target` or a [ref](./refs.md).
- **Choosing a handler from state.** `onClick={s() ? a : b}` would be read once, at render, so it does not compile (RV1016). Write `onClick={() => (s() ? a() : b())}` instead. See [handlers bind once](#handlers-bind-once).
- **Defining handlers in a helper module that reads browser globals.** Write handlers inline in JSX or as local functions in the component.

## See also

- [Forms and input](./forms-and-input.md)
- [Refs](./refs.md)
- [Batching](../state/batching.md)
