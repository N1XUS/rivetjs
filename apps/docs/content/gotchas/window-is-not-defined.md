---
title: Window is not defined
description: Why reading window, document or localStorage in a component fails, and where to put that code instead.
template: gotcha
related: [guides/components/browser-only, guides/state/effects, guides/components/events]
---

## What you see

In a route file (or any app component module a route imports), the build stops with a compiler error:

```txt
Browser global `window` is read during server rendering; move it into a handler, clientEffect or clientEvent
```

The same message names `document`, `localStorage` and other browser globals.

In other modules, the build passes, but the server crashes while it renders the page:

```txt
ReferenceError: window is not defined
```

## Why

Every component runs on the server first. The server is Node.js: it has no `window`, no `document` and no `localStorage`.

In route files the compiler sees this before you run anything. It rejects browser globals in all code that runs during server rendering. That includes helper functions at module level that a component calls, and a `typeof window !== "undefined"` check: the check still reads `window`.

In the browser, the component runs again over the server's HTML, so its render must give the same result in both places (see [render the same thing twice](../learn/resuming.md#render-the-same-thing-twice)). Read `window` where it can differ: in a handler, a `clientEffect` or a `clientEvent`.

## Fix

Read browser globals only in code that runs in the browser:

- event handlers (`onClick`, `onInput`, …),
- `clientEffect`,
- `clientEvent`,
- a component loaded with `clientOnly`.

```tsx title="src/routes/index.tsx"
import { signal } from "@rivetjs/reactivity";
import { clientEffect, clientEvent } from "@rivetjs/runtime/dom";

export default function Page() {
  const width = signal(0);
  const theme = signal("light");

  // Runs in the browser only. The handler reads window when the event fires.
  clientEvent(window, "resize", () => width.set(window.innerWidth));

  // Runs in the browser only, after the page is ready.
  clientEffect(() => {
    theme.set(localStorage.getItem("theme") ?? "light");
  });

  return (
    <main>
      <p>Window width after resize: {width()}</p>
      <button onClick={() => localStorage.setItem("theme", "dark")}>Use dark theme</button>
      <p>Theme: {theme()}</p>
    </main>
  );
}
```

Passing `window` or `document` as the target of `clientEvent` is allowed. The listener is added in the browser.

:::tip
Write handlers inline in JSX. A helper function at module level that reads `document` is still server code when a component calls it during render.
:::

The server renders the first value (`0`, `"light"`). The browser updates it later. If the first value must match the visitor, read it on the server instead, for example from a cookie in the page's `load(…)` function.
