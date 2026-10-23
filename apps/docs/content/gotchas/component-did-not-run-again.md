---
title: Component did not run again
description: Why a value computed at the top of a component never updates, and how to make it follow your signals.
template: gotcha
related: [learn/resuming, guides/state/computed, guides/state/signals]
---

## What you see

You change a signal. The button shows the new count, but another value on the page stays the same. A `console.log` at the top of the component prints once in the browser, at the first click, and never again.

```tsx
import { signal } from "@rivetjs/reactivity";

export default function Counter() {
  const count = signal(0);
  const doubled = count() * 2; // read once
  console.log("render", count()); // on the server, then once in the browser when the component wakes up

  return (
    <div>
      <button onClick={() => count.set(count() + 1)}>Count: {count()}</button>
      <p>Doubled: {doubled}</p> {/* stays 0 */}
    </div>
  );
}
```

## Why

In React, a component function runs again on every state change. In Rivet it does not.

A component runs on the server to make the HTML. In the browser the page :term[resumes]{id=resumability}: nothing runs on load, and the first time you use the component, the browser runs it once over the server's HTML, starting from the server's signal values. After that, only three kinds of code run:

- event handlers, like `onClick`,
- effects (`effect`, `clientEffect`),
- the JSX expressions that read a signal that changed.

`const doubled = count() * 2` is plain JavaScript at the top of the component. It ran on the server, and once more in the browser with the same `count`, and saved the number `0` both times. Nothing reads `count` there again.

When a visitor goes to another page through a link, the new page's component runs once in the browser to build that page. It still does not run again when its signals change.

## Fix

Read the signal where the value is used: inside JSX, or inside a `computed`.

```tsx
import { signal, computed } from "@rivetjs/reactivity";

export default function Counter() {
  const count = signal(0);
  const doubled = computed(() => count() * 2); // [!code highlight]

  return (
    <div>
      <button onClick={() => count.set(count() + 1)}>Count: {count()}</button>
      <p>Doubled: {doubled()}</p>
      <p>Tripled: {count() * 3}</p>
    </div>
  );
}
```

- `{count() * 3}` in JSX updates by itself: the expression reads `count`, so it runs again when `count` changes.
- `computed` gives the value a name. Call it like a signal: `doubled()`.
- To run code when a signal changes (logging, the document title, a timer), use an effect. See [effects](../guides/state/effects.md).

:::note
In development, an edit of a component file reloads the page. See [Dev and production differ](dev-and-production-differ.md).
:::
