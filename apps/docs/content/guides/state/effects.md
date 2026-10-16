---
title: Effects
description: Run browser code when signals change with clientEffect, clean up after it, and know when to use effect from the reactivity package.
template: guide
related: [guides/state/signals, guides/components/browser-only, guides/components/refs]
---

An :term[effect]{id=effect} is code that runs again when the signals it reads change. Use it to sync the page with something outside it: the tab title, a canvas, a third-party widget, `localStorage`. After reading this page you can write effects in components, clean up after them, and choose when they start.

::example{id=effect-title}

## Two functions

Rivet has two effect functions. In components you almost always want the first one.

| Function | Import | Runs |
| --- | --- | --- |
| `clientEffect(fn, options?)` | `@rivetjs/runtime/dom` | Only in the browser, after the page is ready. Never on the server. |
| `effect(fn)` | `@rivetjs/reactivity` | Right away, where you call it. |

The reason: a component runs once, on the server. A plain `effect` inside a component runs there, during the server render, and is not picked up again in the browser. `clientEffect` is recorded on the server and started in the browser.

## Write a client effect

```tsx title="src/routes/index.tsx"
import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";

export default function Inbox() {
  const unread = signal(0);
  clientEffect(() => {
    document.title = `${unread()} unread`;
  });
  return (
    <button type="button" onClick={() => unread.update((n) => n + 1)}>
      New message
    </button>
  );
}
```

The effect runs once in the browser, then again each time `unread` changes. Code inside it may use `document`, `window` and other browser globals, because it never runs on the server. See [browser-only code](../components/browser-only.md).

::api{symbol="@rivetjs/runtime/dom#clientEffect"}

## Clean up

Return a function from the effect. Rivet calls it before the effect runs again, and when the part of the page that owns the effect goes away.

```tsx
clientEffect(() => {
  if (!running()) return;
  const timer = setInterval(() => seconds.update((s) => s + 1), 1000);
  return () => clearInterval(timer);
});
```

Here the interval stops when `running` becomes `false`, and a new one starts when it becomes `true` again.

## Choose when it starts

On a server-rendered page, the `when` option says when the browser starts the effect:

| `when` | Starts |
| --- | --- |
| `"idle"` | When the browser has free time after the page loads. |
| `"load"` | Same as `"idle"` for effects. |
| `"visible"` | When the element the effect uses (through a [ref](../components/refs.md)) comes near the screen. |
| `"interaction"` | At the first pointer press or key press anywhere on the page. |
| `"media:(query)"` | When the media query matches, for example `"media:(min-width: 800px)"`. |

The default is `"visible"` if the effect uses a ref, otherwise `"idle"`.

```tsx
let canvas!: HTMLCanvasElement;
clientEffect(() => {
  const ctx = canvas.getContext("2d")!;
  ctx.fillRect(0, 0, 12 * count(), 10);
}, { when: "visible" });
// ...
<canvas width={240} height={12} ref={(el) => (canvas = el)} />;
```

## Async effects

The effect function may be `async`. Rivet tracks only the signals read before the first `await`. Read the signals you need first:

```tsx
const loadAnalytics = () => import("../analytics.ts");

clientEffect(async () => {
  const path = url().pathname; // read before await: tracked
  const { pageView } = await loadAnalytics();
  pageView(path);
}, { when: "idle" });
```

A returned cleanup only works from a non-async effect. The [analytics recipe](/recipes/analytics-page-views.md) shows this pattern in full.

## effect from @rivetjs/reactivity

`effect(fn)` runs `fn` right away and again on every change. It returns a function that stops it. Use it in plain TypeScript code and in tests, outside components.

```ts
import { effect, onCleanup, signal } from "@rivetjs/reactivity";

const name = signal("Ada");
const stop = effect(() => {
  console.log("Hello", name());
  onCleanup(() => console.log("before the next run"));
});
name.set("Grace"); // logs "before the next run", then "Hello Grace"
stop();
```

`onCleanup` registers cleanup for the current effect run. It throws `onCleanup requires a live owner` outside an effect or root.

::api{symbol="@rivetjs/reactivity#effect"}

## Common mistakes

- **Using `effect` in a component for browser work.** It runs on the server only. Use `clientEffect`.
- **Copying values between signals.** If an effect only sets one signal from another, use a [computed value](./computed.md).
- **Writing a signal the effect reads.** The effect triggers itself. Rivet stops after 10,000 runs with `Reactive effect did not settle after 10000 executions`.
- **Capturing values that cannot be saved.** An effect in a resumed page can use component values only if they are :term[serializable]{id=serializable}. See [serializable captures](/best-practices/serializable-captures.md).

## See also

- [Browser-only code](../components/browser-only.md)
- [Refs](../components/refs.md)
- [Batching](./batching.md)
